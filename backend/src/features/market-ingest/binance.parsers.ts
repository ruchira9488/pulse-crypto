import type { BookLevel } from '@pulse/contracts';
import type { MarketEvent } from '../market-state';

/**
 * Stream names for the Binance combined endpoint.
 * - depth{N}@100ms: top-N partial book snapshot every 100ms
 * - aggTrade:       every (aggregated) trade, so the price is live
 * - miniTicker:     rolling 24h open/high/low/volume, once a second
 */
export function buildStreamNames(pairs: readonly string[], depthLevels: number): string[] {
  return pairs.flatMap((pair) => {
    const s = pair.toLowerCase();
    return [`${s}@depth${depthLevels}@100ms`, `${s}@aggTrade`, `${s}@miniTicker`];
  });
}

export function buildStreamUrl(baseUrl: string, pairs: readonly string[], depthLevels: number): string {
  return `${baseUrl}?streams=${buildStreamNames(pairs, depthLevels).join('/')}`;
}

const toLevels = (raw: unknown): BookLevel[] | null => {
  if (!Array.isArray(raw)) return null;
  const out: BookLevel[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const level = raw[i];
    const price = Number(level?.[0]);
    const qty = Number(level?.[1]);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return null;
    out[i] = [price, qty];
  }
  return out;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Converts one combined-stream frame into a normalised MarketEvent.
 * Returns null for anything unrecognised or malformed; the caller counts those
 * rather than crashing on a bad frame.
 */
export function parseCombinedFrame(frame: unknown, now: () => number = Date.now): MarketEvent | null {
  if (typeof frame !== 'object' || frame === null) return null;
  const { stream, data } = frame as { stream?: unknown; data?: Record<string, unknown> };
  if (typeof stream !== 'string' || typeof data !== 'object' || data === null) return null;

  const at = stream.indexOf('@');
  if (at <= 0) return null;
  const pair = stream.slice(0, at).toUpperCase();
  const kind = stream.slice(at + 1);

  if (kind.startsWith('depth')) {
    const bids = toLevels(data.bids);
    const asks = toLevels(data.asks);
    if (!bids || !asks) return null;
    // Partial depth frames carry no event time; stamp on receipt.
    return { kind: 'depth', pair, eventTime: now(), bids, asks };
  }

  if (kind === 'aggTrade') {
    const price = num(data.p);
    if (!(price > 0)) return null;
    return { kind: 'trade', pair, eventTime: num(data.E) || now(), price };
  }

  if (kind === 'miniTicker') {
    const event = {
      kind: 'ticker' as const,
      pair,
      eventTime: num(data.E) || now(),
      lastPrice: num(data.c),
      openPrice: num(data.o),
      high: num(data.h),
      low: num(data.l),
      volume: num(data.v),
    };
    if ([event.lastPrice, event.openPrice, event.high, event.low, event.volume].some(Number.isNaN)) return null;
    return event;
  }

  return null;
}
