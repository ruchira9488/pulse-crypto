import { describe, expect, it } from 'vitest';
import { Backoff } from '../shared/backoff';
import { DEFAULT_PAIRS, loadConfig } from './config';

describe('loadConfig', () => {
  it('provides sensible defaults', () => {
    const c = loadConfig({});
    expect(c.pairs).toEqual(DEFAULT_PAIRS);
    expect(c.broadcast.defaultIntervalMs).toBe(100);
    expect(c.port).toBe(8080);
    expect(c.marketSource).toBe('binance');
  });

  it('normalises PAIRS', () => {
    expect(loadConfig({ PAIRS: ' btcusdt, ethusdt ,' }).pairs).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ BROADCAST_INTERVAL_MS: 'fast' })).toThrow(/BROADCAST_INTERVAL_MS/);
    expect(() => loadConfig({ BROADCAST_INTERVAL_MS: '5000' })).toThrow(/BROADCAST_INTERVAL_MS/);
    expect(() => loadConfig({ DEPTH_LEVELS: '7' })).toThrow(/DEPTH_LEVELS/);
    expect(() => loadConfig({ MARKET_SOURCE: 'kraken' })).toThrow(/MARKET_SOURCE/);
  });
});

describe('Backoff', () => {
  it('grows exponentially, is capped, and resets', () => {
    const b = new Backoff(100, 1_000, () => 1);
    expect([b.next(), b.next(), b.next(), b.next(), b.next()]).toEqual([100, 200, 400, 800, 1_000]);
    b.reset();
    expect(b.next()).toBe(100);
  });

  it('applies jitter between 50% and 100% of the ceiling', () => {
    const b = new Backoff(1_000, 10_000, () => 0);
    expect(b.next()).toBe(500);
  });
});
