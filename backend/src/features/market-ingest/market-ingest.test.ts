import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';
import type { UpstreamStatus } from '@pulse/contracts';
import { Backoff } from '../../shared/backoff';
import { silentLogger } from '../../shared/logger';
import type { MarketEvent } from '../market-state';
import { BinanceStreamClient } from './binance-stream.client';
import { buildStreamUrl, parseCombinedFrame } from './binance.parsers';
import { SyntheticFeed } from './synthetic-feed';

describe('Binance parsers', () => {
  it('builds a combined stream url', () => {
    expect(buildStreamUrl('wss://x/stream', ['BTCUSDT'], 20)).toBe(
      'wss://x/stream?streams=btcusdt@depth20@100ms/btcusdt@aggTrade/btcusdt@miniTicker',
    );
  });

  it('parses partial depth', () => {
    const e = parseCombinedFrame(
      { stream: 'btcusdt@depth20@100ms', data: { lastUpdateId: 1, bids: [['100.5', '2']], asks: [['101', '0.5']] } },
      () => 42,
    );
    expect(e).toEqual({ kind: 'depth', pair: 'BTCUSDT', eventTime: 42, bids: [[100.5, 2]], asks: [[101, 0.5]] });
  });

  it('parses aggTrade and miniTicker', () => {
    expect(parseCombinedFrame({ stream: 'ethusdt@aggTrade', data: { E: 7, p: '3400.1' } })).toEqual({
      kind: 'trade',
      pair: 'ETHUSDT',
      eventTime: 7,
      price: 3400.1,
    });
    expect(
      parseCombinedFrame({ stream: 'solusdt@miniTicker', data: { E: 9, c: '150', o: '140', h: '155', l: '139', v: '1000' } }),
    ).toMatchObject({ kind: 'ticker', pair: 'SOLUSDT', openPrice: 140, high: 155 });
  });

  it('rejects malformed frames instead of throwing', () => {
    expect(parseCombinedFrame(null)).toBeNull();
    expect(parseCombinedFrame({ stream: 'btcusdt@depth20@100ms', data: { bids: [['x', '1']], asks: [] } })).toBeNull();
    expect(parseCombinedFrame({ stream: 'btcusdt@aggTrade', data: { p: 'NaN' } })).toBeNull();
    expect(parseCombinedFrame({ stream: 'btcusdt@kline_1m', data: {} })).toBeNull();
  });
});

describe('BinanceStreamClient', () => {
  let server: WebSocketServer | undefined;
  let client: BinanceStreamClient | undefined;

  afterEach(async () => {
    await client?.stop();
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  });

  it('forwards parsed events and reconnects after the upstream drops', async () => {
    server = new WebSocketServer({ port: 0 });
    let connections = 0;
    server.on('connection', (ws) => {
      connections += 1;
      ws.send(JSON.stringify({ stream: 'btcusdt@aggTrade', data: { E: connections, p: '100' } }));
      if (connections === 1) setTimeout(() => ws.terminate(), 20);
    });
    const port = (server.address() as AddressInfo).port;

    const events: MarketEvent[] = [];
    const statuses: UpstreamStatus[] = [];
    client = new BinanceStreamClient({
      url: `ws://127.0.0.1:${port}/stream`,
      pairs: ['BTCUSDT'],
      depthLevels: 20,
      logger: silentLogger,
      backoff: new Backoff(10, 20),
      onEvent: (e) => events.push(e),
      onStatus: (s) => statuses.push(s),
    });
    client.start();

    await waitFor(() => events.length >= 2);
    expect(connections).toBe(2);
    expect(statuses).toEqual(['connected', 'reconnecting', 'connected']);
  });
});

describe('SyntheticFeed', () => {
  it('emits depth, trade and ticker events for each pair', async () => {
    const events: MarketEvent[] = [];
    const feed = new SyntheticFeed({
      pairs: ['BTCUSDT', 'ETHUSDT'],
      depthLevels: 5,
      eventsPerSecond: 500,
      onEvent: (e) => events.push(e),
      onStatus: () => {},
    });
    feed.start();
    await waitFor(() => events.some((e) => e.kind === 'depth' && e.pair === 'ETHUSDT'));
    await feed.stop();
    const kinds = new Set(events.map((e) => e.kind));
    expect(kinds).toEqual(new Set(['depth', 'trade', 'ticker']));
    const depth = events.find((e) => e.kind === 'depth');
    expect(depth && depth.kind === 'depth' && depth.bids[0]![0] < depth.asks[0]![0]).toBe(true);
  });
});

async function waitFor(cond: () => boolean, timeoutMs = 2_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}
