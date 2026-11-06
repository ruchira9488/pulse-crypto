import type { BookLevel } from '@pulse/contracts';

export interface DepthCurve {
  /**
   * Normalised cumulative depth (0..1), `samples` points per side.
   * bids[0] is the far end of the book (left edge), bids[n-1] the best bid (centre).
   * asks[0] is the best ask (centre), asks[n-1] the far end (right edge).
   * A fixed point count lets successive curves be interpolated for smooth animation.
   */
  bids: number[];
  asks: number[];
  bidTotal: number;
  askTotal: number;
}

/** Cumulative quantity available within `distance` of the best price (step function). */
function cumulativeAt(levels: readonly BookLevel[], best: number, distance: number): number {
  let sum = 0;
  for (const [price, qty] of levels) {
    if (Math.abs(price - best) > distance + 1e-12) break;
    sum += qty;
  }
  return sum;
}

export function computeDepthCurve(bids: readonly BookLevel[], asks: readonly BookLevel[], samples = 24): DepthCurve {
  const empty = new Array<number>(samples).fill(0);
  if (bids.length === 0 || asks.length === 0) return { bids: empty, asks: [...empty], bidTotal: 0, askTotal: 0 };

  const bestBid = bids[0]![0];
  const bestAsk = asks[0]![0];
  // Both sides share one price scale so the chart is symmetric and comparable.
  const span = Math.max(bestBid - bids[bids.length - 1]![0], asks[asks.length - 1]![0] - bestAsk, Number.EPSILON);

  const bidTotal = bids.reduce((s, [, q]) => s + q, 0);
  const askTotal = asks.reduce((s, [, q]) => s + q, 0);
  const max = Math.max(bidTotal, askTotal) || 1;

  const bidCurve: number[] = [];
  const askCurve: number[] = [];
  for (let i = 0; i < samples; i++) {
    const distance = (span * i) / (samples - 1);
    askCurve.push(cumulativeAt(asks, bestAsk, distance) / max);
    // Bids are drawn right-to-left from the centre.
    bidCurve.unshift(cumulativeAt(bids, bestBid, distance) / max);
  }
  return { bids: bidCurve, asks: askCurve, bidTotal, askTotal };
}

export type LiquidityGap = 'Low' | 'Medium' | 'High';
export type PressureLabel = 'Buy Heavy' | 'Sell Heavy' | 'Balanced';

export function liquidityGap(spreadPct: number): LiquidityGap {
  if (spreadPct < 0.05) return 'Low';
  if (spreadPct < 0.2) return 'Medium';
  return 'High';
}

export function pressureLabel(buyPressure: number): PressureLabel {
  if (buyPressure >= 55) return 'Buy Heavy';
  if (buyPressure <= 45) return 'Sell Heavy';
  return 'Balanced';
}
