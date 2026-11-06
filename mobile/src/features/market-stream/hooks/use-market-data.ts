import type { BookLevel, PairTick } from '@pulse/contracts';
import { useMarketStore } from '../store/market.store';

/**
 * Narrow subscriptions. Each hook returns a primitive or a reference that only
 * changes when that pair changes, so zustand's equality check skips re-renders
 * for everything else.
 */
export function usePairTick(pair: string): PairTick | undefined {
  return useMarketStore((s) => s.ticks[pair]);
}

export function usePairPrice(pair: string): number | undefined {
  return useMarketStore((s) => s.ticks[pair]?.price);
}

export function usePairChange(pair: string): number | undefined {
  return useMarketStore((s) => s.ticks[pair]?.change24h);
}

export function usePairTimestamp(pair: string): number | undefined {
  return useMarketStore((s) => s.ticks[pair]?.timestamp);
}

export function useOrderBook(pair: string): { bids: BookLevel[]; asks: BookLevel[] } | undefined {
  // Select the tick (stable per version) and derive; avoids allocating a new object per render.
  const tick = useMarketStore((s) => s.ticks[pair]);
  return tick;
}

export function useStreamPairs(): string[] {
  return useMarketStore((s) => s.pairs);
}

export function useIsFromCache(): boolean {
  return useMarketStore((s) => s.fromCache);
}
