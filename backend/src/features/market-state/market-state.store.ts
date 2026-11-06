import type { BookLevel, PairTick } from '@pulse/contracts';
import type { MarketEvent } from './market-events';
import { changePercent, computeBookMetrics } from './order-book-metrics';

interface PairState {
  pair: string;
  /** Monotonic counter, bumped on every applied event. */
  version: number;
  timestamp: number;
  bids: BookLevel[];
  asks: BookLevel[];
  lastTradePrice: number;
  openPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  /** Lazily built view + its JSON, valid while `cachedVersion === version`. */
  cachedVersion: number;
  cachedTick?: PairTick;
  cachedJson?: string;
}

/**
 * Latest-value-wins ("conflating") store: the core of the buffering strategy.
 *
 * Upstream events overwrite the previous state of their pair in O(1) and bump a
 * version number. Nothing is queued, so memory is bounded by
 * `pairs x depth` regardless of how fast the feed is or how slow clients are.
 *
 * Readers (the broadcaster) pull at their own cadence and compare versions to
 * find what changed. The derived PairTick and its JSON encoding are computed
 * at most once per version, no matter how many clients read it.
 */
export class MarketStateStore {
  private readonly states = new Map<string, PairState>();

  constructor(
    readonly pairs: readonly string[],
    private readonly depthLevels = 20,
  ) {
    for (const pair of pairs) {
      this.states.set(pair, {
        pair,
        version: 0,
        timestamp: 0,
        bids: [],
        asks: [],
        lastTradePrice: 0,
        openPrice: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        cachedVersion: -1,
      });
    }
  }

  /** Folds one upstream event into the pair's state. Returns false for unknown pairs. */
  apply(event: MarketEvent): boolean {
    const state = this.states.get(event.pair);
    if (!state) return false;

    switch (event.kind) {
      case 'depth':
        state.bids = event.bids.length > this.depthLevels ? event.bids.slice(0, this.depthLevels) : event.bids;
        state.asks = event.asks.length > this.depthLevels ? event.asks.slice(0, this.depthLevels) : event.asks;
        break;
      case 'trade':
        state.lastTradePrice = event.price;
        // Keep 24h range consistent with trades that arrive between ticker events.
        if (state.high24h > 0 && event.price > state.high24h) state.high24h = event.price;
        if (state.low24h > 0 && event.price < state.low24h) state.low24h = event.price;
        break;
      case 'ticker':
        state.openPrice = event.openPrice;
        state.high24h = event.high;
        state.low24h = event.low;
        state.volume24h = event.volume;
        if (state.lastTradePrice === 0) state.lastTradePrice = event.lastPrice;
        break;
    }

    state.timestamp = Math.max(state.timestamp, event.eventTime);
    state.version += 1;
    return true;
  }

  version(pair: string): number {
    return this.states.get(pair)?.version ?? 0;
  }

  /** True once a pair has an order book (i.e. it is worth sending to clients). */
  isReady(pair: string): boolean {
    const s = this.states.get(pair);
    return !!s && s.bids.length > 0 && s.asks.length > 0;
  }

  getTick(pair: string): PairTick | undefined {
    const state = this.states.get(pair);
    if (!state || !this.isReady(pair)) return undefined;
    this.refreshCache(state);
    return state.cachedTick;
  }

  /** JSON for the pair's current tick, encoded once per version and shared by all clients. */
  getTickJson(pair: string): string | undefined {
    const state = this.states.get(pair);
    if (!state || !this.isReady(pair)) return undefined;
    this.refreshCache(state);
    return state.cachedJson;
  }

  private refreshCache(state: PairState): void {
    if (state.cachedVersion === state.version) return;
    const m = computeBookMetrics(state.bids, state.asks);
    const price = state.lastTradePrice || m.mid;
    const tick: PairTick = {
      pair: state.pair,
      timestamp: state.timestamp,
      price,
      change24h: changePercent(price, state.openPrice),
      high24h: state.high24h || price,
      low24h: state.low24h || price,
      volume24h: state.volume24h,
      bestBid: m.bestBid,
      bestAsk: m.bestAsk,
      spread: m.spread,
      spreadPct: m.spreadPct,
      buyPressure: m.buyPressure,
      sellPressure: m.sellPressure,
      bids: state.bids,
      asks: state.asks,
    };
    state.cachedTick = tick;
    state.cachedJson = JSON.stringify(tick);
    state.cachedVersion = state.version;
  }
}
