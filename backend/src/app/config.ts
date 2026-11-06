import { INTERVAL_LIMITS } from '@pulse/contracts';

export type MarketSource = 'binance' | 'synthetic';

export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
  pairs: string[];
  marketSource: MarketSource;
  binanceWsUrl: string;
  binanceRestUrl: string;
  /** Order book levels kept per side (Binance partial depth supports 5, 10 or 20). */
  depthLevels: 5 | 10 | 20;
  broadcast: {
    defaultIntervalMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    /** Above this many queued bytes a client's frame is skipped (it gets newer state later). */
    highWaterMarkBytes: number;
    /** Above this many queued bytes a client is disconnected immediately. */
    maxBufferedBytes: number;
    /** A client that stays above the high-water mark for this long is disconnected. */
    slowConsumerTimeoutMs: number;
    heartbeatIntervalMs: number;
    maxClients: number;
  };
  synthetic: {
    /** Upstream events per second per pair when MARKET_SOURCE=synthetic. */
    eventsPerSecond: number;
  };
  metaCacheTtlMs: number;
}

type Env = Record<string, string | undefined>;

function int(env: Env, key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${key}="${raw}": expected an integer between ${min} and ${max}`);
  }
  return value;
}

export const DEFAULT_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];

/** Parses and validates configuration once at startup; fails fast on bad input. */
export function loadConfig(env: Env = process.env): AppConfig {
  const pairs = (env.PAIRS ?? DEFAULT_PAIRS.join(','))
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (pairs.length === 0) throw new Error('PAIRS must contain at least one symbol');

  const marketSource = (env.MARKET_SOURCE ?? 'binance') as MarketSource;
  if (marketSource !== 'binance' && marketSource !== 'synthetic') {
    throw new Error(`Invalid MARKET_SOURCE="${marketSource}": expected "binance" or "synthetic"`);
  }

  const depthLevels = int(env, 'DEPTH_LEVELS', 20);
  if (depthLevels !== 5 && depthLevels !== 10 && depthLevels !== 20) {
    throw new Error('DEPTH_LEVELS must be 5, 10 or 20');
  }

  const minIntervalMs = int(env, 'MIN_INTERVAL_MS', INTERVAL_LIMITS.min, 1);
  const maxIntervalMs = int(env, 'MAX_INTERVAL_MS', INTERVAL_LIMITS.max, minIntervalMs);

  return {
    host: env.HOST ?? '0.0.0.0',
    port: int(env, 'PORT', 8080, 0, 65535), // 0 = ephemeral (tests)
    logLevel: env.LOG_LEVEL ?? 'info',
    pairs,
    marketSource,
    binanceWsUrl: env.BINANCE_WS_URL ?? 'wss://stream.binance.com:9443/stream',
    binanceRestUrl: env.BINANCE_REST_URL ?? 'https://api.binance.com',
    depthLevels,
    broadcast: {
      defaultIntervalMs: int(env, 'BROADCAST_INTERVAL_MS', INTERVAL_LIMITS.default, minIntervalMs, maxIntervalMs),
      minIntervalMs,
      maxIntervalMs,
      highWaterMarkBytes: int(env, 'HIGH_WATER_MARK_BYTES', 256 * 1024, 1024),
      maxBufferedBytes: int(env, 'MAX_BUFFERED_BYTES', 4 * 1024 * 1024, 1024),
      slowConsumerTimeoutMs: int(env, 'SLOW_CONSUMER_TIMEOUT_MS', 15_000, 100),
      heartbeatIntervalMs: int(env, 'HEARTBEAT_INTERVAL_MS', 15_000, 100),
      maxClients: int(env, 'MAX_CLIENTS', 1_000, 1),
    },
    synthetic: {
      eventsPerSecond: int(env, 'SYNTHETIC_EVENTS_PER_SECOND', 50, 1, 10_000),
    },
    metaCacheTtlMs: int(env, 'META_CACHE_TTL_MS', 10_000, 0),
  };
}
