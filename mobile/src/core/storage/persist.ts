import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Namespaced keys so app data can be found (and wiped) predictably. */
export const storageKeys = {
  favourites: 'pulse/favourites/v1',
  settings: 'pulse/settings/v1',
  selectedPair: 'pulse/selected-pair/v1',
  pairsMeta: 'pulse/pairs-meta/v1',
  lastTicks: 'pulse/last-ticks/v1',
} as const;

/** Shared AsyncStorage adapter for zustand's `persist` middleware. */
export const persistStorage = createJSONStorage(() => AsyncStorage);

/** Approximate bytes used by this app's keys (for the Settings "storage" card). */
export async function measureStorageBytes(): Promise<number> {
  try {
    const entries = await AsyncStorage.multiGet(Object.values(storageKeys));
    return entries.reduce((sum, [key, value]) => sum + key.length + (value?.length ?? 0), 0);
  } catch {
    return 0;
  }
}
