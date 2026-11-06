import { useDeferredValue, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFavouritesStore } from '@/features/favourites';
import { useStreamPairs } from '@/features/market-stream';
import { usePairsMetaStore } from '@/features/pairs-meta';
import { filterPairs, mergePairLists, type WatchlistFilter } from './filter-pairs';

/** Visible symbols for the current filter. Re-computes only when inputs change, never per tick. */
export function useWatchlist(filter: WatchlistFilter): { symbols: string[]; favouriteCount: number } {
  const metaOrder = usePairsMetaStore((s) => s.order);
  const displayNames = usePairsMetaStore(
    useShallow((s) => Object.fromEntries(Object.values(s.bySymbol).map((m) => [m.symbol, m.displayName]))),
  );
  const streamPairs = useStreamPairs();
  const favourites = useFavouritesStore((s) => s.symbols);
  // Typing stays responsive: filtering yields to urgent updates.
  const query = useDeferredValue(filter.query);

  const symbols = useMemo(
    () => filterPairs(mergePairLists(metaOrder, streamPairs), favourites, { ...filter, query }, displayNames),
    [metaOrder, streamPairs, favourites, filter, query, displayNames],
  );
  return { symbols, favouriteCount: favourites.length };
}
