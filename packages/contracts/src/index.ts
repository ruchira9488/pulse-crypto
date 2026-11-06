/**
 * PulseCrypto wire protocol.
 *
 * This package is the single source of truth for every message exchanged
 * between the gateway (backend) and the mobile client. Both sides import
 * these types so a protocol change becomes a compile error on the other side.
 *
 * Transport: one WebSocket per client at `ws://<host>:<port>/ws`, JSON text frames.
 * REST: `GET /pairs/meta` returns {@link PairsMetaResponse}.
 */

/** Binance-style symbol, e.g. "BTCUSDT". */
export type PairSymbol = string;

/** One order-book level: [price, quantity]. Tuples keep frames ~40% smaller than objects. */
export type BookLevel = [price: number, quantity: number];

/** Upstream (Binance) feed health as seen by the gateway. */
export type UpstreamStatus = 'connecting' | 'connected' | 'reconnecting' | 'down';

/** Latest processed market state for one pair. */
export interface PairTick {
  pair: PairSymbol;
  /** Epoch milliseconds of the most recent upstream event folded into this tick. */
  timestamp: number;
  /** Last traded price. */
  price: number;
  /** 24h change in percent, e.g. 1.82 = +1.82%. */
  change24h: number;
  high24h: number;
  low24h: number;
  /** 24h base-asset volume. */
  volume24h: number;
  bestBid: number;
  bestAsk: number;
  /** Absolute spread: bestAsk - bestBid. */
  spread: number;
  /** Spread relative to mid price, in percent. */
  spreadPct: number;
  /** Share of resting bid quantity within the visible depth, 0–100. */
  buyPressure: number;
  /** Share of resting ask quantity within the visible depth, 0–100. buy + sell = 100. */
  sellPressure: number;
  /** Bids, best (highest) first. */
  bids: BookLevel[];
  /** Asks, best (lowest) first. */
  asks: BookLevel[];
}

/** Per-connection settings a client may change at runtime. */
export interface ClientConfig {
  /** Target interval between frames sent to this client (ms). */
  intervalMs: number;
  /** When true the gateway widens the interval automatically while the client is behind. */
  adaptive: boolean;
  /** Request permessage-deflate on frames (only effective if negotiated). */
  compress: boolean;
}

export const INTERVAL_LIMITS = { min: 10, max: 1000, default: 100 } as const;

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export interface HelloMessage {
  type: 'hello';
  protocolVersion: typeof PROTOCOL_VERSION;
  serverTime: number;
  pairs: PairSymbol[];
  config: ClientConfig;
  /** Whether permessage-deflate was negotiated on this socket. */
  compressionAvailable: boolean;
  upstream: UpstreamStatus;
}

/** Full state of every pair. Sent once right after `hello`. */
export interface SnapshotMessage {
  type: 'snapshot';
  seq: number;
  serverTime: number;
  data: PairTick[];
}

/** Only pairs that changed since the previous frame sent to this client. */
export interface UpdateMessage {
  type: 'update';
  seq: number;
  serverTime: number;
  /** Effective interval currently applied (may differ from requested when adaptive). */
  effectiveIntervalMs: number;
  data: PairTick[];
}

export interface ConfigAckMessage {
  type: 'config';
  config: ClientConfig;
}

export interface PongMessage {
  type: 'pong';
  id: number;
  clientTime: number;
  serverTime: number;
}

export interface UpstreamStatusMessage {
  type: 'upstream';
  status: UpstreamStatus;
}

export interface ErrorMessage {
  type: 'error';
  code: 'bad_request' | 'unsupported';
  message: string;
}

export type ServerMessage =
  | HelloMessage
  | SnapshotMessage
  | UpdateMessage
  | ConfigAckMessage
  | PongMessage
  | UpstreamStatusMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export interface ConfigureMessage {
  type: 'configure';
  intervalMs?: number;
  adaptive?: boolean;
  compress?: boolean;
}

export interface PingMessage {
  type: 'ping';
  id: number;
  clientTime: number;
}

export type ClientMessage = ConfigureMessage | PingMessage;

export const PROTOCOL_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

export type TradingStatus = 'TRADING' | 'HALT' | 'BREAK' | 'UNKNOWN';

export interface PairMeta {
  symbol: PairSymbol;
  /** Human readable, e.g. "BTC / USDT". */
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  status: TradingStatus;
  lastPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  /** Mocked: last price x hard-coded circulating supply. */
  marketCap: number;
}

export interface PairsMetaResponse {
  /** "binance" when fetched live, "mock" when the upstream REST API was unavailable. */
  source: 'binance' | 'mock';
  updatedAt: number;
  pairs: PairMeta[];
}
