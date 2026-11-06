import type { UpstreamStatus } from '@pulse/contracts';
import type { ConnectionStatus } from '@/features/market-stream';
import { colors } from '@/core/theme';

export type ConnectionTone = 'live' | 'warn' | 'down' | 'idle';

export interface ConnectionView {
  tone: ConnectionTone;
  label: string;
  /** Longer explanation for the banner; undefined when everything is healthy. */
  detail?: string;
}

/**
 * Collapses socket status + upstream status into one user-facing state.
 * Pure function: easy to test, and every badge and banner agrees.
 */
export function describeConnection(status: ConnectionStatus, upstream: UpstreamStatus, retryInMs?: number): ConnectionView {
  switch (status) {
    case 'connected':
      if (upstream === 'connected') return { tone: 'live', label: 'LIVE' };
      return {
        tone: 'warn',
        label: 'DELAYED',
        detail: 'Connected to PulseCrypto, but the exchange feed is reconnecting. Prices may be stale.',
      };
    case 'connecting':
      return { tone: 'warn', label: 'CONNECTING', detail: 'Connecting to the market gateway…' };
    case 'reconnecting':
      return {
        tone: 'down',
        label: 'RECONNECTING',
        detail: `Connection lost. Showing last received data${
          retryInMs ? `, retrying in ${Math.max(1, Math.round(retryInMs / 1000))}s` : ''
        }.`,
      };
    case 'offline':
      return { tone: 'down', label: 'OFFLINE', detail: 'No network connection. Showing last received data.' };
    case 'paused':
      return { tone: 'idle', label: 'PAUSED' };
  }
}

export const toneColors: Record<ConnectionTone, { fg: string; bg: string }> = {
  live: { fg: colors.up, bg: 'rgba(0, 197, 122, 0.12)' },
  warn: { fg: colors.warning, bg: 'rgba(245, 181, 68, 0.12)' },
  down: { fg: colors.down, bg: 'rgba(255, 59, 105, 0.12)' },
  idle: { fg: colors.textMuted, bg: colors.surfaceRaised },
};
