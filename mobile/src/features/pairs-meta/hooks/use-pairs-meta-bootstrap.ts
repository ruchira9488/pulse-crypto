import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useConnectionStore } from '@/features/market-stream';
import { usePairsMetaStore } from '../store/pairs-meta.store';

/**
 * Mount once at the root: loads metadata at launch, again when the app returns
 * to the foreground, and after the gateway comes back if the last fetch failed.
 */
export function usePairsMetaBootstrap(): void {
  useEffect(() => {
    const refresh = () => void usePairsMetaStore.getState().refresh();
    refresh();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const unsub = useConnectionStore.subscribe((s, prev) => {
      if (s.status === 'connected' && prev.status !== 'connected' && usePairsMetaStore.getState().error) refresh();
    });
    return () => {
      appState.remove();
      unsub();
    };
  }, []);
}
