import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 8080;

/**
 * Where the gateway lives during development.
 *
 * 1. EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WS_URL win when set.
 * 2. Otherwise reuse the host Metro is served from (Expo's `hostUri`), which
 *    is the dev machine's LAN IP and works for emulators and real devices.
 * 3. Fallback: 10.0.2.2 is the Android emulator's alias for the host's
 *    localhost; iOS simulators share the host network.
 */
function resolveDevHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

const host = resolveDevHost();

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? `http://${host}:${BACKEND_PORT}`,
  wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? `ws://${host}:${BACKEND_PORT}/ws`,
} as const;
