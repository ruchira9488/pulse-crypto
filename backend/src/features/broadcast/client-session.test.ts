import { describe, expect, it } from 'vitest';
import { MarketStateStore } from '../market-state';
import { parseClientMessage } from './client-protocol';
import { ClientSession, SLOW_CONSUMER_CLOSE_CODE, type SessionSocket } from './client-session';

class FakeSocket implements SessionSocket {
  readyState = 1;
  bufferedAmount = 0;
  sent: { data: string; compress: boolean }[] = [];
  closed?: { code: number; reason: string };
  send(data: string, options: { compress: boolean }) {
    this.sent.push({ data, compress: options.compress });
  }
  terminate() {
    this.readyState = 3;
  }
  close(code: number, reason: string) {
    this.closed = { code, reason };
    this.readyState = 3;
  }
  frames() {
    return this.sent.map((s) => JSON.parse(s.data));
  }
}

const limits = {
  minIntervalMs: 10,
  maxIntervalMs: 1000,
  highWaterMarkBytes: 1_000,
  maxBufferedBytes: 10_000,
  slowConsumerTimeoutMs: 500,
};

function setup(adaptive = false) {
  const store = new MarketStateStore(['BTCUSDT', 'ETHUSDT']);
  const socket = new FakeSocket();
  let now = 0;
  const clock = { advance: (ms: number) => (now += ms) };
  let slow = 0;
  const session = new ClientSession('c1', socket, store, limits, { intervalMs: 100, adaptive, compress: true }, () => now, () => slow++);
  const book = (pair: string, bid: number) =>
    store.apply({ kind: 'depth', pair, eventTime: now, bids: [[bid, 1]], asks: [[bid + 1, 1]] });
  return { store, socket, session, clock, book, slowCount: () => slow };
}

describe('ClientSession', () => {
  it('sends a snapshot of ready pairs on start', () => {
    const { socket, session, book } = setup();
    book('BTCUSDT', 100);
    session.start();
    session.stop();
    const [snap] = socket.frames();
    expect(snap.type).toBe('snapshot');
    expect(snap.data.map((t: { pair: string }) => t.pair)).toEqual(['BTCUSDT']);
  });

  it('batches only changed pairs, conflating bursts into the latest value', () => {
    const { socket, session, book } = setup();
    book('BTCUSDT', 100);
    book('ETHUSDT', 10);
    session.start();
    session.stop();
    socket.sent = [];

    for (let i = 1; i <= 500; i++) book('BTCUSDT', 100 + i);
    session.flush();
    const frames = socket.frames();
    expect(frames).toHaveLength(1);
    expect(frames[0].type).toBe('update');
    expect(frames[0].data).toHaveLength(1);
    expect(frames[0].data[0]).toMatchObject({ pair: 'BTCUSDT', bestBid: 600 });

    session.flush();
    expect(socket.sent).toHaveLength(1); // nothing changed -> no frame
  });

  it('skips frames above the high-water mark without losing the latest state', () => {
    const { socket, session, book } = setup();
    session.start();
    session.stop();
    socket.sent = [];

    book('BTCUSDT', 100);
    socket.bufferedAmount = 5_000;
    session.flush();
    expect(socket.sent).toHaveLength(0);
    expect(session.stats.framesSkipped).toBe(1);

    book('BTCUSDT', 200);
    socket.bufferedAmount = 0;
    session.flush();
    expect(socket.frames()[0].data[0].bestBid).toBe(200);
  });

  it('disconnects a client that exceeds the hard buffer limit', () => {
    const { socket, session, book, slowCount } = setup();
    book('BTCUSDT', 100);
    socket.bufferedAmount = 20_000;
    session.flush();
    expect(socket.closed?.code).toBe(SLOW_CONSUMER_CLOSE_CODE);
    expect(slowCount()).toBe(1);
  });

  it('disconnects a client that stays congested past the timeout', () => {
    const { socket, session, clock, book } = setup();
    book('BTCUSDT', 100);
    socket.bufferedAmount = 2_000;
    session.flush();
    clock.advance(400);
    session.flush();
    expect(socket.closed).toBeUndefined();
    clock.advance(200);
    session.flush();
    expect(socket.closed?.code).toBe(SLOW_CONSUMER_CLOSE_CODE);
  });

  it('adaptive mode backs off while congested and recovers afterwards', () => {
    const { socket, session, book } = setup(true);
    book('BTCUSDT', 100);
    socket.bufferedAmount = 2_000;
    session.flush();
    session.flush();
    expect(session.effectiveIntervalMs).toBe(400);

    socket.bufferedAmount = 0;
    for (let i = 0; i < 10; i++) session.flush();
    expect(session.effectiveIntervalMs).toBe(200);
    for (let i = 0; i < 10; i++) session.flush();
    expect(session.effectiveIntervalMs).toBe(100);
  });

  it('clamps configured intervals and honours compression preference', () => {
    const { socket, session, book } = setup();
    expect(session.configure({ intervalMs: 1 }).intervalMs).toBe(10);
    expect(session.configure({ intervalMs: 99_999 }).intervalMs).toBe(1000);
    session.configure({ compress: false });
    book('BTCUSDT', 100);
    session.flush();
    session.stop();
    expect(socket.sent.at(-1)?.compress).toBe(false);
  });
});

describe('parseClientMessage', () => {
  it('accepts valid messages', () => {
    expect(parseClientMessage('{"type":"ping","id":1,"clientTime":5}')).toEqual({
      ok: true,
      message: { type: 'ping', id: 1, clientTime: 5 },
    });
    expect(parseClientMessage('{"type":"configure","intervalMs":250,"adaptive":true}')).toEqual({
      ok: true,
      message: { type: 'configure', intervalMs: 250, adaptive: true },
    });
  });

  it('rejects invalid input without throwing', () => {
    expect(parseClientMessage('nope').ok).toBe(false);
    expect(parseClientMessage('[]').ok).toBe(false);
    expect(parseClientMessage('{"type":"configure","intervalMs":"fast"}').ok).toBe(false);
    expect(parseClientMessage('{"type":"configure","compress":1}').ok).toBe(false);
    expect(parseClientMessage('{"type":"subscribe"}').ok).toBe(false);
  });
});
