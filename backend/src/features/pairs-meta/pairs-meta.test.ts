import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from '../../shared/logger';
import { MarketStateStore } from '../market-state';
import { PairsMetaService, splitSymbol } from './pairs-meta.service';

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

function binanceFetch() {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('ticker/24hr')) {
      return json([{ symbol: 'BTCUSDT', lastPrice: '100', priceChangePercent: '1.82', highPrice: '110', lowPrice: '90', volume: '5' }]);
    }
    return json({ symbols: [{ symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT' }] });
  });
}

describe('splitSymbol', () => {
  it('splits by known quote assets', () => {
    expect(splitSymbol('DOGEUSDT')).toEqual({ baseAsset: 'DOGE', quoteAsset: 'USDT' });
    expect(splitSymbol('ETHBTC')).toEqual({ baseAsset: 'ETH', quoteAsset: 'BTC' });
  });
});

describe('PairsMetaService', () => {
  const make = (fetchImpl: typeof fetch, cacheTtlMs = 10_000) =>
    new PairsMetaService({
      pairs: ['BTCUSDT'],
      restUrl: 'https://binance.test',
      cacheTtlMs,
      store: new MarketStateStore(['BTCUSDT']),
      logger: silentLogger,
      fetchImpl,
    });

  it('maps Binance REST data', async () => {
    const res = await make(binanceFetch() as unknown as typeof fetch).get();
    expect(res.source).toBe('binance');
    expect(res.pairs[0]).toEqual({
      symbol: 'BTCUSDT',
      displayName: 'BTC / USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      status: 'TRADING',
      lastPrice: 100,
      change24h: 1.82,
      high24h: 110,
      low24h: 90,
      volume24h: 5,
      marketCap: 1_980_000_000,
    });
  });

  it('caches and coalesces concurrent requests', async () => {
    const f = binanceFetch();
    const service = make(f as unknown as typeof fetch);
    await Promise.all([service.get(), service.get(), service.get()]);
    await service.get();
    expect(f).toHaveBeenCalledTimes(2); // one ticker + one exchangeInfo call
  });

  it('falls back to mock data when Binance fails, without caching the failure', async () => {
    const f = vi.fn(async () => {
      throw new Error('ENOTFOUND');
    });
    const service = make(f as unknown as typeof fetch);
    const res = await service.get();
    expect(res.source).toBe('mock');
    expect(res.pairs[0]).toMatchObject({ symbol: 'BTCUSDT', displayName: 'BTC / USDT', status: 'UNKNOWN' });
    await service.get();
    expect(f.mock.calls.length).toBeGreaterThan(2);
  });
});
