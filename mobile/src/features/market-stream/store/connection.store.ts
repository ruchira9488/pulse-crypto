import type { ClientConfig, UpstreamStatus } from '@pulse/contracts';
import { create } from 'zustand';
import type { ConnectionStatus } from '../api/market-socket';

export interface ConnectionState {
  status: ConnectionStatus;
  attempt: number;
  retryInMs?: number;
  /** Binance -> gateway health, reported by the gateway. */
  upstream: UpstreamStatus;
  latencyMs?: number;
  /** Interval the server is actually applying (differs from requested when adaptive). */
  effectiveIntervalMs?: number;
  serverConfig?: ClientConfig;
  compressionAvailable: boolean;
  /** When live data last arrived before the current outage. */
  lastLiveAt?: number;
  set: (patch: Partial<Omit<ConnectionState, 'set'>>) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: 'connecting',
  attempt: 0,
  upstream: 'connecting',
  compressionAvailable: false,
  set: (patch) => set(patch),
}));

/** True only when data is flowing end to end (device -> gateway -> Binance). */
export const selectIsLive = (s: ConnectionState) => s.status === 'connected' && s.upstream === 'connected';
