import { useIsFocused } from 'expo-router';
import type { PropsWithChildren } from 'react';

/**
 * Mounts live content only while its tab is focused.
 *
 * `freezeOnBlur` alone is not enough: frozen screens keep their store
 * subscriptions, and React still renders those updates at low priority. On a
 * 10ms stream that work competes with the visible screen. Unmounting
 * live subtrees removes the subscriptions entirely; remounting on focus
 * is cheap because the data lives in stores, not components.
 */
export function FocusGate({ children }: PropsWithChildren) {
  const focused = useIsFocused();
  return focused ? children : null;
}
