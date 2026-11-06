import { describe, expect, it } from 'vitest';
import { MarketStateStore } from './market-state.store';
import { changePercent, computeBookMetrics } from './order-book-metrics';

describe('computeBookMetrics', () => {
  it('derives spread and notional-weighted pressure', () => {
    const m = computeBookMetrics(
      [
        [100, 3],
        [99, 1],
      ],
      [
        [101, 1],
        [102, 1],
      ],
    );
    expect(m.bestBid).toBe(100);
    expect(m.bestAsk).toBe(101);
    expect(m.spread).toBe(1);
    expect(m.spreadPct).toBeCloseTo((1 / 100.5) * 100, 3);
    // bids 399 vs asks 203 notional
    expect(m.buyPressure).toBeCloseTo(66.3, 1);
    expect(m.buyPressure + m.sellPressure).toBeCloseTo(100, 6);
  });

  it('is neutral for an empty book', () => {
    const m = computeBookMetrics([], []);
    expect(m).toMatchObject({ spread: 0, spreadPct: 0, buyPressure: 50, sellPressure: 50 });
  });

  it('rounds float noise out of the spread', () => {
    const m = computeBookMetrics([[0.1, 1]], [[0.3, 1]]);
    expect(m.spread).toBe(0.2);
  });
});

describe('changePercent', () => {
  it('computes percent change and guards zero open', () => {
    expect(changePercent(110, 100)).toBe(10);
    expect(changePercent(98.18, 100)).toBe(-1.82);
    expect(changePercent(5, 0)).toBe(0);
  });
});

describe('MarketStateStore', () => {
  const depth = (pair: string, bid: number, ask: number) => ({
    kind: 'depth' as const,
    pair,
    eventTime: 1,
    bids: [[bid, 1]] as [number, number][],
    asks: [[ask, 1]] as [number, number][],
  });

  it('ignores unknown pairs', () => {
    const store = new MarketStateStore(['BTCUSDT']);
    expect(store.apply(depth('NOPE', 1, 2))).toBe(false);
  });

  it('is not ready until a book arrives', () => {
    const store = new MarketStateStore(['BTCUSDT']);
    store.apply({ kind: 'trade', pair: 'BTCUSDT', eventTime: 1, price: 10 });
    expect(store.isReady('BTCUSDT')).toBe(false);
    expect(store.getTick('BTCUSDT')).toBeUndefined();
  });

  it('keeps only the latest state (conflation) and bumps the version per event', () => {
    const store = new MarketStateStore(['BTCUSDT']);
    for (let i = 0; i < 1_000; i++) store.apply(depth('BTCUSDT', 100 + i, 101 + i));
    expect(store.version('BTCUSDT')).toBe(1_000);
    const tick = store.getTick('BTCUSDT');
    expect(tick?.bestBid).toBe(1_099);
    expect(tick?.bids).toHaveLength(1);
  });

  it('falls back to mid price before the first trade, then uses the last trade', () => {
    const store = new MarketStateStore(['BTCUSDT']);
    store.apply(depth('BTCUSDT', 100, 102));
    expect(store.getTick('BTCUSDT')?.price).toBe(101);
    store.apply({ kind: 'trade', pair: 'BTCUSDT', eventTime: 2, price: 101.5 });
    expect(store.getTick('BTCUSDT')?.price).toBe(101.5);
  });

  it('computes 24h change from the ticker open and extends the range with trades', () => {
    const store = new MarketStateStore(['BTCUSDT']);
    store.apply(depth('BTCUSDT', 100, 102));
    store.apply({ kind: 'ticker', pair: 'BTCUSDT', eventTime: 3, lastPrice: 100, openPrice: 100, high: 105, low: 95, volume: 7 });
    store.apply({ kind: 'trade', pair: 'BTCUSDT', eventTime: 4, price: 110 });
    const tick = store.getTick('BTCUSDT');
    expect(tick).toMatchObject({ price: 110, change24h: 10, high24h: 110, low24h: 95, volume24h: 7, timestamp: 4 });
  });

  it('truncates the book to the configured depth', () => {
    const store = new MarketStateStore(['BTCUSDT'], 5);
    const levels = Array.from({ length: 20 }, (_, i) => [100 - i, 1] as [number, number]);
    store.apply({ kind: 'depth', pair: 'BTCUSDT', eventTime: 1, bids: levels, asks: levels.map(([p, q]) => [p + 50, q]) });
    expect(store.getTick('BTCUSDT')?.bids).toHaveLength(5);
  });

  it('encodes JSON once per version and reuses it', () => {
    const store = new MarketStateStore(['BTCUSDT']);
    store.apply(depth('BTCUSDT', 100, 101));
    const a = store.getTickJson('BTCUSDT');
    const b = store.getTickJson('BTCUSDT');
    expect(a).toBe(b);
    expect(JSON.parse(a!)).toMatchObject({ pair: 'BTCUSDT', bestBid: 100 });
    store.apply(depth('BTCUSDT', 100.5, 101));
    expect(store.getTickJson('BTCUSDT')).not.toBe(a);
  });
});
