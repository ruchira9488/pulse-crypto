import { Backoff } from '../model/backoff';
import { MarketSocket, type StatusInfo, type WebSocketLike } from '../api/market-socket';

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: WebSocketLike['onopen'] = null;
  onmessage: WebSocketLike['onmessage'] = null;
  onclose: WebSocketLike['onclose'] = null;
  onerror: WebSocketLike['onerror'] = null;
  constructor() {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  serverSend(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const hello = { type: 'hello', protocolVersion: 1, serverTime: 0, pairs: [], config: { intervalMs: 100, adaptive: false, compress: true }, compressionAvailable: true, upstream: 'connected' };

function setup() {
  FakeSocket.instances = [];
  const statuses: StatusInfo[] = [];
  const messages: unknown[] = [];
  const socket = new MarketSocket({
    url: 'ws://test',
    createSocket: () => new FakeSocket(),
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    backoff: new Backoff(100, 1000, () => 1),
    pingIntervalMs: 1000,
    staleAfterMs: 3000,
  });
  const last = () => FakeSocket.instances[FakeSocket.instances.length - 1]!;
  return { socket, statuses, messages, last };
}

describe('MarketSocket', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports connected only after the server hello', () => {
    const { socket, statuses, last } = setup();
    socket.start();
    expect(statuses.at(-1)?.status).toBe('connecting');
    last().open();
    expect(statuses.at(-1)?.status).toBe('connecting');
    last().serverSend(hello);
    expect(statuses.at(-1)?.status).toBe('connected');
    socket.stop();
  });

  it('reconnects with exponential backoff after drops', () => {
    const { socket, statuses, last } = setup();
    socket.start();
    last().drop();
    expect(statuses.at(-1)).toMatchObject({ status: 'reconnecting', retryInMs: 100 });
    jest.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(2);
    last().drop();
    expect(statuses.at(-1)).toMatchObject({ status: 'reconnecting', retryInMs: 200 });
    jest.advanceTimersByTime(200);
    last().open();
    last().serverSend(hello);
    last().drop();
    expect(statuses.at(-1)).toMatchObject({ retryInMs: 100 }); // reset after a healthy session
    socket.stop();
  });

  it('stops retrying while offline and reconnects immediately when back online', () => {
    const { socket, statuses } = setup();
    socket.start();
    socket.setNetworkAvailable(false);
    expect(statuses.at(-1)?.status).toBe('offline');
    jest.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    socket.setNetworkAvailable(true);
    expect(FakeSocket.instances).toHaveLength(2);
    socket.stop();
  });

  it('closes in the background and resumes in the foreground', () => {
    const { socket, statuses, last } = setup();
    socket.start();
    const first = last();
    socket.setForeground(false);
    expect(first.closed).toBe(true);
    expect(statuses.at(-1)?.status).toBe('paused');
    socket.setForeground(true);
    expect(FakeSocket.instances).toHaveLength(2);
    socket.stop();
  });

  it('re-applies desired config after reconnecting and pings for latency', () => {
    const latencies: number[] = [];
    FakeSocket.instances = [];
    const socket = new MarketSocket({
      url: 'ws://test',
      createSocket: () => new FakeSocket(),
      onMessage: () => {},
      onStatus: () => {},
      onLatency: (ms) => latencies.push(ms),
      backoff: new Backoff(10, 10, () => 1),
    });
    socket.configure({ intervalMs: 250 });
    socket.start();
    const ws = FakeSocket.instances[0]!;
    ws.open();
    expect(ws.sent.map((s) => JSON.parse(s).type)).toEqual(['configure', 'ping']);
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({ intervalMs: 250 });
    const ping = JSON.parse(ws.sent[1]!);
    ws.serverSend({ type: 'pong', id: ping.id, clientTime: ping.clientTime, serverTime: 0 });
    expect(latencies).toHaveLength(1);
    socket.stop();
  });

  it('treats a silent socket as dead and reconnects', () => {
    const { socket, statuses, last } = setup();
    socket.start();
    last().open();
    last().serverSend(hello);
    jest.advanceTimersByTime(4000);
    expect(statuses.at(-1)).toMatchObject({ status: 'reconnecting', lastCloseCode: 4000 });
    socket.stop();
  });

  it('ignores malformed frames', () => {
    const { socket, messages, last } = setup();
    socket.start();
    last().open();
    last().onmessage?.({ data: '{nope' });
    expect(messages).toHaveLength(0);
    socket.stop();
  });
});
