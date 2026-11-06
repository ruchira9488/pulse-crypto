import type { BookLevel } from '@pulse/contracts';

export interface BookMetrics {
  bestBid: number;
  bestAsk: number;
  mid: number;
  spread: number;
  spreadPct: number;
  buyPressure: number;
  sellPressure: number;
}

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** Sum of price x quantity, i.e. resting liquidity in quote currency. */
export function notional(levels: readonly BookLevel[]): number {
  let total = 0;
  for (const [price, qty] of levels) total += price * qty;
  return total;
}

/**
 * Derives the headline metrics from a top-N book.
 *
 * Buy/sell pressure is the share of resting *notional* on each side of the
 * visible book. Notional (not raw quantity) keeps the measure meaningful
 * when the two sides span slightly different price ranges.
 */
export function computeBookMetrics(bids: readonly BookLevel[], asks: readonly BookLevel[]): BookMetrics {
  const bestBid = bids[0]?.[0] ?? 0;
  const bestAsk = asks[0]?.[0] ?? 0;
  const hasBoth = bestBid > 0 && bestAsk > 0;
  const mid = hasBoth ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
  const spread = hasBoth ? bestAsk - bestBid : 0;

  const bidNotional = notional(bids);
  const askNotional = notional(asks);
  const total = bidNotional + askNotional;
  const buyPressure = total > 0 ? round((bidNotional / total) * 100, 1) : 50;

  return {
    bestBid,
    bestAsk,
    mid,
    // Avoid float noise such as 0.010000000009313226 on the wire.
    spread: round(spread, 10),
    spreadPct: mid > 0 ? round((spread / mid) * 100, 4) : 0,
    buyPressure,
    sellPressure: round(100 - buyPressure, 1),
  };
}

/** 24h change in percent relative to the rolling-window open price. */
export function changePercent(price: number, openPrice: number): number {
  if (!(openPrice > 0)) return 0;
  return round(((price - openPrice) / openPrice) * 100, 2);
}
