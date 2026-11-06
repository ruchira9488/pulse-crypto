import type { PairMeta, PairsMetaResponse } from '@pulse/contracts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, storageKeys } from '@/core/storage/persist';
import { fetchPairsMeta } from '../api/pairs-meta.api';

interface PairsMetaState {
  bySymbol: Record<string, PairMeta>;
  order: string[];
  source?: PairsMetaResponse['source'];
  updatedAt?: number;
  loading: boolean;
  error?: string;
  /** Fetches GET /pairs/meta. Independent of the WebSocket, which keeps streaming. */
  refresh: () => Promise<void>;
}

export const usePairsMetaStore = create<PairsMetaState>()(
  persist(
    (set, get) => ({
      bySymbol: {},
      order: [],
      loading: false,
      refresh: async () => {
        if (get().loading) return;
        set({ loading: true, error: undefined });
        try {
          const res = await fetchPairsMeta();
          set({
            bySymbol: Object.fromEntries(res.pairs.map((p) => [p.symbol, p])),
            order: res.pairs.map((p) => p.symbol),
            source: res.source,
            updatedAt: res.updatedAt,
            loading: false,
          });
        } catch (err) {
          // Keep the previous (persisted) metadata on failure.
          set({ loading: false, error: (err as Error).message });
        }
      },
    }),
    {
      name: storageKeys.pairsMeta,
      storage: persistStorage,
      partialize: ({ bySymbol, order, source, updatedAt }) => ({ bySymbol, order, source, updatedAt }),
    },
  ),
);

export const usePairMeta = (symbol: string): PairMeta | undefined => usePairsMetaStore((s) => s.bySymbol[symbol]);
