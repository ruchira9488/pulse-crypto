import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, storageKeys } from '@/core/storage/persist';

interface SelectedPairState {
  pair: string;
  select: (pair: string) => void;
}

/** Pair shown on the Terminal tab; remembered across launches. */
export const useSelectedPairStore = create<SelectedPairState>()(
  persist((set) => ({ pair: 'BTCUSDT', select: (pair) => set({ pair }) }), {
    name: storageKeys.selectedPair,
    storage: persistStorage,
  }),
);

export const useSelectedPair = () => useSelectedPairStore((s) => s.pair);
