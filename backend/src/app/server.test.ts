import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { PairsMetaResponse, ServerMessage, UpdateMessage } from '@pulse/contracts';
import { loadConfig } from './config';
import { createServer, type PulseServer } from './server';

/** End-to-end: synthetic feed -> store -> gateway -> real WebSocket client. */
describe('PulseCrypto server (integration)', () => {
  let server: PulseServer;
  let base: string;

  beforeAll(async () => {
    server = createServer(
      loadConfig({
        PORT: '0',
        HOST: '127.0.0.1',
        LOG_LEVEL: 'silent',
        MARKET_SOURCE: 'synthetic',
        SYNTHETIC_EVENTS_PER_SECOND: '500',
        BINANCE_REST_URL: 'http://127.0.0.1:1', // unreachable -> mock metadata
      }),
    );
    base = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('serves /pairs/meta for every pair', async () => {
    const res = await fetch(`${base}/pairs/meta`);
    const body = (await res.json()) as PairsMetaResponse;
    expect(res.status).toBe(200);
    expect(body.pairs.map((p) => p.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);
    expect(body.source).toBe('mock');
  });

  it('streams hello, snapshot, batched updates, and honours configure/ping', async () => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`, { perMessageDeflate: true });
    const messages: ServerMessage[] = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    await new Promise((r) => ws.once('open', r));

    await waitFor(() => messages.filter((m) => m.type === 'update').length >= 3);
    expect(messages[0]).toMatchObject({ type: 'hello', protocolVersion: 1, compressionAvailable: true });
    expect(messages[1]?.type).toBe('snapshot');
    const update = messages.find((m): m is UpdateMessage => m.type === 'update')!;
    expect(update.data.length).toBeGreaterThan(0);
    for (const tick of update.data) {
      expect(tick.bids.length).toBeGreaterThan(0);
      expect(tick.buyPressure + tick.sellPressure).toBeCloseTo(100, 5);
    }

    ws.send(JSON.stringify({ type: 'configure', intervalMs: 500, adaptive: true }));
    ws.send(JSON.stringify({ type: 'ping', id: 7, clientTime: 123 }));
    await waitFor(() => messages.some((m) => m.type === 'config') && messages.some((m) => m.type === 'pong'));
    expect(messages.find((m) => m.type === 'config')).toMatchObject({ config: { intervalMs: 500, adaptive: true } });
    expect(messages.find((m) => m.type === 'pong')).toMatchObject({ id: 7, clientTime: 123 });

    ws.send('garbage');
    await waitFor(() => messages.some((m) => m.type === 'error'));

    const health = (await (await fetch(`${base}/health`)).json()) as { clients: number; upstream: string };
    expect(health).toMatchObject({ clients: 1, upstream: 'connected' });
    ws.close();
  });

  it('rejects upgrades on unknown paths', async () => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/nope`);
    const err = await new Promise<Error>((r) => ws.once('error', r));
    expect(err.message).toMatch(/404/);
  });
});

async function waitFor(cond: () => boolean, timeoutMs = 3_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}
