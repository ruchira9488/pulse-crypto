import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClientConfig, PairTick, ServerMessage } from '@pulse/contracts';
import { env } from '@/core/config/env';
import { storageKeys } from '@/core/storage/persist';
import { MarketSocket, type StatusInfo } from './api/market-socket';
import { streamMetrics } from './model/stream-metrics';
import { TickBuffer } from './model/tick-buffer';
import { useConnectionStore } from './store/connection.store';
import { useMarketStore } from './store/market.store';

/**
 * Wires the socket to the stores. This module is the only writer of market and
 * connection state; UI only reads through hooks.
 */
const buffer = new TickBuffer((ticks) => {
  streamMetrics.commits += 1;
  useMarketStore.getState().applyTicks(ticks);
});

function onMessage(message: ServerMessage, byteLength: number): void {
  streamMetrics.messages += 1;
  streamMetrics.bytes += byteLength;
  streamMetrics.lastMessageAt = Date.now();
  const connection = useConnectionStore.getState();

  switch (message.type) {
    case 'hello':
      connection.set({
        upstream: message.upstream,
        serverConfig: message.config,
        compressionAvailable: message.compressionAvailable,
        effectiveIntervalMs: message.config.intervalMs,
      });
      useMarketStore.getState().setPairs(message.pairs);
      break;
    case 'snapshot':
      streamMetrics.ticksReceived += message.data.length;
      buffer.push(message.data);
      buffer.flush(); // first paint shouldn't wait for a frame
      break;
    case 'update':
      streamMetrics.ticksReceived += message.data.length;
      buffer.push(message.data);
      if (message.effectiveIntervalMs !== connection.effectiveIntervalMs) {
        connection.set({ effectiveIntervalMs: message.effectiveIntervalMs });
      }
      break;
    case 'config':
      connection.set({ serverConfig: message.config, effectiveIntervalMs: message.config.intervalMs });
      break;
    case 'upstream':
      connection.set({ upstream: message.status });
      break;
    case 'error':
      if (__DEV__) console.warn('[market-stream] server error', message.code, message.message);
      break;
    case 'pong':
      break;
  }
}

function onStatus(info: StatusInfo): void {
  const prev = useConnectionStore.getState();
  if (info.status === 'reconnecting' && prev.status === 'connected') streamMetrics.reconnects += 1;
  const leftLive = prev.status === 'connected' && info.status !== 'connected';
  prev.set({
    status: info.status,
    attempt: info.attempt,
    retryInMs: info.retryInMs,
    // Remember when data last actually flowed, for "showing data from HH:MM:SS".
    ...(leftLive ? { lastLiveAt: streamMetrics.lastMessageAt || Date.now() } : null),
  });
}

let socket: MarketSocket | undefined;

/** Created lazily so `configure()` can be called (e.g. by persisted settings) before `start()`. */
function ensureSocket(url: string = env.wsUrl): MarketSocket {
  socket ??= new MarketSocket({
    url,
    onMessage,
    onStatus,
    onLatency: (latencyMs) => useConnectionStore.getState().set({ latencyMs }),
  });
  return socket;
}

export const marketStream = {
  start(url?: string): void {
    ensureSocket(url).start();
  },
  stop(): void {
    socket?.stop();
    buffer.clear();
  },
  configure(config: Partial<ClientConfig>): void {
    ensureSocket().configure(config);
  },
  setNetworkAvailable(available: boolean): void {
    socket?.setNetworkAvailable(available);
  },
  setForeground(foreground: boolean): void {
    socket?.setForeground(foreground);
  },
  reconnectNow(): void {
    socket?.reconnectNow();
  },

  /** Persist the last ticks so a cold start while offline still shows data. */
  async saveSnapshot(): Promise<void> {
    const { ticks, fromCache } = useMarketStore.getState();
    if (fromCache || Object.keys(ticks).length === 0) return;
    try {
      await AsyncStorage.setItem(storageKeys.lastTicks, JSON.stringify(ticks));
    } catch {
      // Best effort only.
    }
  },
  async restoreSnapshot(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(storageKeys.lastTicks);
      if (raw) useMarketStore.getState().hydrateFromCache(JSON.parse(raw) as Record<string, PairTick>);
    } catch {
      // Corrupt cache: ignore, live data will replace it.
    }
  },
};

export type MarketStream = typeof marketStream;
