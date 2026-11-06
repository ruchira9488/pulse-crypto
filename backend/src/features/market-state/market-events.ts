import type { BookLevel } from '@pulse/contracts';

/**
 * Normalised upstream events. Any market source (Binance, synthetic, a future
 * exchange) produces these; the market-state feature is the only consumer.
 */
export type MarketEvent = DepthEvent | TradeEvent | TickerEvent;

/** Top-N order book snapshot (Binance partial depth stream). */
export interface DepthEvent {
  kind: 'depth';
  pair: string;
  eventTime: number;
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface TradeEvent {
  kind: 'trade';
  pair: string;
  eventTime: number;
  price: number;
}

/** Rolling 24h statistics. */
export interface TickerEvent {
  kind: 'ticker';
  pair: string;
  eventTime: number;
  lastPrice: number;
  openPrice: number;
  high: number;
  low: number;
  volume: number;
}

/** Anything that can push MarketEvents (Binance socket, synthetic generator...). */
export interface MarketSource {
  start(): void;
  stop(): Promise<void>;
}
