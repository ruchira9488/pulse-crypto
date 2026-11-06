import type { PairMeta, PairsMetaResponse, TradingStatus } from '@pulse/contracts';
import type { Logger } from '../../shared/logger';
import type { MarketStateStore } from '../market-state';

/** Approximate circulating supply, used only to mock market cap. */
const CIRCULATING_SUPPLY: Record<string, number> = {
  BTC: 19_800_000,
  ETH: 120_700_000,
  SOL: 470_000_000,
  DOGE: 146_000_000_000,
  XRP: 57_000_000_000,
};

const KNOWN_QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB'];

export function splitSymbol(symbol: string): { baseAsset: string; quoteAsset: string } {
  const quote = KNOWN_QUOTES.find((q) => symbol.endsWith(q) && symbol.length > q.length);
  return quote
    ? { baseAsset: symbol.slice(0, -quote.length), quoteAsset: quote }
    : { baseAsset: symbol, quoteAsset: '' };
}

const mockMarketCap = (base: string, price: number) => Math.round((CIRCULATING_SUPPLY[base] ?? 0) * price);

const toStatus = (s: unknown): TradingStatus =>
  s === 'TRADING' || s === 'HALT' || s === 'BREAK' ? s : 'UNKNOWN';

export interface PairsMetaServiceOptions {
  pairs: readonly string[];
  restUrl: string;
  cacheTtlMs: number;
  store: MarketStateStore;
  logger: Logger;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Serves GET /pairs/meta.
 *
 * Fetches 24h stats + trading status from Binance REST, caches them briefly and
 * coalesces concurrent requests into one upstream call. If Binance is
 * unreachable it degrades to data derived from the live stream (or seeds), flagged
 * `source: "mock"`, so the app keeps working.
 */
export class PairsMetaService {
  private cache?: { at: number; value: PairsMetaResponse };
  private inFlight?: Promise<PairsMetaResponse>;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: PairsMetaServiceOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async get(): Promise<PairsMetaResponse> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < this.opts.cacheTtlMs) return this.cache.value;
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async load(): Promise<PairsMetaResponse> {
    try {
      const value = await this.fetchFromBinance();
      this.cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      this.opts.logger.warn({ err: (err as Error).message }, 'Binance REST unavailable, serving mock metadata');
      // Not cached: the next pull-to-refresh retries the real API.
      return this.buildMock();
    }
  }

  private async fetchFromBinance(): Promise<PairsMetaResponse> {
    const symbols = encodeURIComponent(JSON.stringify(this.opts.pairs));
    const signal = AbortSignal.timeout(this.opts.timeoutMs ?? 5_000);
    const [tickersRes, infoRes] = await Promise.all([
      this.fetchImpl(`${this.opts.restUrl}/api/v3/ticker/24hr?symbols=${symbols}`, { signal }),
      this.fetchImpl(`${this.opts.restUrl}/api/v3/exchangeInfo?symbols=${symbols}`, { signal }),
    ]);
    if (!tickersRes.ok) throw new Error(`ticker/24hr responded ${tickersRes.status}`);
    if (!infoRes.ok) throw new Error(`exchangeInfo responded ${infoRes.status}`);

    const tickers = (await tickersRes.json()) as Array<Record<string, string>>;
    const info = (await infoRes.json()) as { symbols?: Array<Record<string, unknown>> };
    const infoBySymbol = new Map((info.symbols ?? []).map((s) => [String(s.symbol), s]));
    const tickerBySymbol = new Map(tickers.map((t) => [t.symbol, t]));

    const pairs: PairMeta[] = this.opts.pairs.map((symbol) => {
      const t = tickerBySymbol.get(symbol);
      const i = infoBySymbol.get(symbol);
      const split = splitSymbol(symbol);
      const baseAsset = typeof i?.baseAsset === 'string' ? i.baseAsset : split.baseAsset;
      const quoteAsset = typeof i?.quoteAsset === 'string' ? i.quoteAsset : split.quoteAsset;
      const lastPrice = Number(t?.lastPrice ?? 0);
      return {
        symbol,
        displayName: `${baseAsset} / ${quoteAsset}`,
        baseAsset,
        quoteAsset,
        status: toStatus(i?.status),
        lastPrice,
        change24h: Number(t?.priceChangePercent ?? 0),
        high24h: Number(t?.highPrice ?? 0),
        low24h: Number(t?.lowPrice ?? 0),
        volume24h: Number(t?.volume ?? 0),
        marketCap: mockMarketCap(baseAsset, lastPrice),
      };
    });

    return { source: 'binance', updatedAt: Date.now(), pairs };
  }

  private buildMock(): PairsMetaResponse {
    const pairs: PairMeta[] = this.opts.pairs.map((symbol) => {
      const { baseAsset, quoteAsset } = splitSymbol(symbol);
      const tick = this.opts.store.getTick(symbol);
      const price = tick?.price ?? 0;
      return {
        symbol,
        displayName: `${baseAsset} / ${quoteAsset}`,
        baseAsset,
        quoteAsset,
        status: tick ? 'TRADING' : 'UNKNOWN',
        lastPrice: price,
        change24h: tick?.change24h ?? 0,
        high24h: tick?.high24h ?? 0,
        low24h: tick?.low24h ?? 0,
        volume24h: tick?.volume24h ?? 0,
        marketCap: mockMarketCap(baseAsset, price),
      };
    });
    return { source: 'mock', updatedAt: Date.now(), pairs };
  }
}
