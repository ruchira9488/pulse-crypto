import type { PairTick } from '@pulse/contracts';
import { create } from 'zustand';

export interface MarketState {
  /** Latest tick per pair. Each pair's object is replaced only when that pair changes. */
  ticks: Record<string, PairTick>;
  /** Pair list announced by the server (hello). */
  pairs: string[];
  /** True when ticks came from the on-device cache rather than the live socket. */
  fromCache: boolean;
  applyTicks: (ticks: readonly PairTick[]) => void;
  setPairs: (pairs: string[]) => void;
  hydrateFromCache: (ticks: Record<string, PairTick>) => void;
}

/**
 * Live market data. Kept deliberately flat: components subscribe with narrow
 * selectors (e.g. one pair's price), so an ETH update never re-renders a BTC row.
 */
export const useMarketStore = create<MarketState>()((set, get) => ({
  ticks: {},
  pairs: [],
  fromCache: false,
  applyTicks: (incoming) => {
    if (incoming.length === 0) return;
    const ticks = { ...get().ticks };
    for (const tick of incoming) ticks[tick.pair] = tick;
    set({ ticks, fromCache: false });
  },
  setPairs: (pairs) => {
    const current = get().pairs;
    if (current.length === pairs.length && current.every((p, i) => p === pairs[i])) return;
    set({ pairs });
  },
  hydrateFromCache: (ticks) => {
    if (Object.keys(get().ticks).length > 0) return; // live data already arrived
    set({ ticks, pairs: Object.keys(ticks), fromCache: true });
  },
}));
