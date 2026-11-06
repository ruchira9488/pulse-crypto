import type { BookLevel, UpstreamStatus } from '@pulse/contracts';
import type { MarketEvent, MarketSource } from '../market-state';

/** Rough starting prices so the synthetic feed looks plausible. */
const SEED_PRICES: Record<string, number> = {
  BTCUSDT: 64_000,
  ETHUSDT: 3_400,
  SOLUSDT: 150,
  DOGEUSDT: 0.16,
  XRPUSDT: 0.6,
};

export interface SyntheticFeedOptions {
  pairs: readonly string[];
  depthLevels: number;
  eventsPerSecond: number;
  onEvent: (event: MarketEvent) => void;
  onStatus: (status: UpstreamStatus) => void;
  random?: () => number;
}

interface Walk {
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  tick: number;
}

/**
 * Deterministic-ish random-walk market. Used for offline development, demos
 * without network access, and stress tests (e.g. 2,000 events/s per pair)
 * that the real feed can't produce on demand.
 */
export class SyntheticFeed implements MarketSource {
  private timer?: NodeJS.Timeout;
  private tickerTimer?: NodeJS.Timeout;
  private readonly walks = new Map<string, Walk>();
  private readonly random: () => number;

  constructor(private readonly opts: SyntheticFeedOptions) {
    this.random = opts.random ?? Math.random;
    for (const pair of opts.pairs) {
      const price = SEED_PRICES[pair] ?? 100;
      // Smallest price step, scaled to the magnitude of the price.
      const tick = 10 ** (Math.floor(Math.log10(price)) - 4);
      this.walks.set(pair, { price, open: price, high: price, low: price, volume: 0, tick });
    }
  }

  start(): void {
    if (this.timer) return;
    this.opts.onStatus('connected');
    const intervalMs = 10;
    const perTick = Math.max(1, Math.round((this.opts.eventsPerSecond * intervalMs) / 1000));
    this.timer = setInterval(() => {
      for (const pair of this.opts.pairs) {
        for (let i = 0; i < perTick; i++) this.step(pair);
      }
    }, intervalMs);
    this.tickerTimer = setInterval(() => this.emitTickers(), 1000);
    this.emitTickers();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    clearInterval(this.tickerTimer);
    this.timer = undefined;
  }

  private step(pair: string): void {
    const w = this.walks.get(pair)!;
    const drift = (this.random() - 0.5) * w.price * 0.0004;
    w.price = Math.max(w.tick, w.price + drift);
    w.high = Math.max(w.high, w.price);
    w.low = Math.min(w.low, w.price);
    w.volume += this.random();
    const now = Date.now();

    if (this.random() < 0.5) {
      this.opts.onEvent({ kind: 'trade', pair, eventTime: now, price: this.roundToTick(w.price, w.tick) });
    } else {
      this.opts.onEvent({ kind: 'depth', pair, eventTime: now, ...this.book(w) });
    }
  }

  private book(w: Walk): { bids: BookLevel[]; asks: BookLevel[] } {
    const bids: BookLevel[] = [];
    const asks: BookLevel[] = [];
    const best = this.roundToTick(w.price, w.tick);
    const qtyScale = 1_000 / w.price;
    for (let i = 0; i < this.opts.depthLevels; i++) {
      bids.push([this.roundToTick(best - (i + 1) * w.tick, w.tick), round(this.random() * qtyScale * (1 + i / 4), 5)]);
      asks.push([this.roundToTick(best + (i + 1) * w.tick, w.tick), round(this.random() * qtyScale * (1 + i / 4), 5)]);
    }
    return { bids, asks };
  }

  private emitTickers(): void {
    const now = Date.now();
    for (const [pair, w] of this.walks) {
      this.opts.onEvent({
        kind: 'ticker',
        pair,
        eventTime: now,
        lastPrice: w.price,
        openPrice: w.open,
        high: w.high,
        low: w.low,
        volume: round(w.volume, 3),
      });
    }
  }

  private roundToTick(value: number, tick: number): number {
    return round(Math.round(value / tick) * tick, 8);
  }
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
