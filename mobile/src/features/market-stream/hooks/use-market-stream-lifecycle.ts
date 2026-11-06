import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { marketStream } from '../market-stream.service';

/**
 * Mount once at the app root. Owns the socket lifecycle:
 * - restores the last cached ticks (offline cold start), then connects;
 * - follows connectivity (NetInfo) and foreground/background (AppState);
 * - snapshots data to disk when the app goes to the background.
 */
export function useMarketStreamLifecycle(): void {
  useEffect(() => {
    void marketStream.restoreSnapshot();
    marketStream.start();

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      // `isConnected` is null while unknown: assume online rather than blocking.
      marketStream.setNetworkAvailable(state.isConnected !== false);
    });

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        marketStream.setForeground(true);
      } else if (next === 'background') {
        void marketStream.saveSnapshot();
        marketStream.setForeground(false);
      }
    });

    return () => {
      unsubscribeNet();
      appStateSub.remove();
      marketStream.stop();
    };
  }, []);
}
