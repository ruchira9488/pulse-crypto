import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, storageKeys } from '@/core/storage/persist';

interface FavouritesState {
  /** Insertion-ordered list of favourite symbols. */
  symbols: string[];
  toggle: (symbol: string) => void;
}

/** Persisted to AsyncStorage and restored automatically on app start. */
export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      symbols: [],
      toggle: (symbol) => {
        const current = get().symbols;
        set({ symbols: current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol] });
      },
    }),
    { name: storageKeys.favourites, storage: persistStorage, version: 1 },
  ),
);

export const useIsFavourite = (symbol: string): boolean =>
  useFavouritesStore((s) => s.symbols.includes(symbol));
