import { INTERVAL_LIMITS, type ClientConfig } from '@pulse/contracts';
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, storageKeys } from '@/core/storage/persist';
import { marketStream } from '@/features/market-stream';

interface SettingsState extends ClientConfig {
  setIntervalMs: (ms: number) => void;
  setAdaptive: (on: boolean) => void;
  setCompress: (on: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      intervalMs: INTERVAL_LIMITS.default,
      adaptive: false,
      compress: true,
      setIntervalMs: (ms) =>
        set({ intervalMs: Math.round(Math.min(INTERVAL_LIMITS.max, Math.max(INTERVAL_LIMITS.min, ms))) }),
      setAdaptive: (adaptive) => set({ adaptive }),
      setCompress: (compress) => set({ compress }),
    }),
    {
      name: storageKeys.settings,
      storage: persistStorage,
      partialize: ({ intervalMs, adaptive, compress }) => ({ intervalMs, adaptive, compress }),
    },
  ),
);

/**
 * Mount once at the root. Pushes the persisted (and every changed) config to
 * the gateway. The socket also re-sends it after each reconnect.
 */
export function useSettingsSync(): void {
  useEffect(() => {
    const push = () => {
      const { intervalMs, adaptive, compress } = useSettingsStore.getState();
      marketStream.configure({ intervalMs, adaptive, compress });
    };
    const unsubHydrate = useSettingsStore.persist.onFinishHydration(push);
    if (useSettingsStore.persist.hasHydrated()) push();
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.intervalMs !== prev.intervalMs || state.adaptive !== prev.adaptive || state.compress !== prev.compress) push();
    });
    return () => {
      unsubHydrate();
      unsub();
    };
  }, []);
}
