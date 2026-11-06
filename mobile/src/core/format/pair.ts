const QUOTES = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB'];

/** "BTCUSDT" -> { base: "BTC", quote: "USDT" } */
export function splitPair(symbol: string): { base: string; quote: string } {
  const quote = QUOTES.find((q) => symbol.endsWith(q) && symbol.length > q.length);
  return quote ? { base: symbol.slice(0, -quote.length), quote } : { base: symbol, quote: '' };
}

/** "BTCUSDT" -> "BTC/USDT" (compact) or "BTC / USDT" (spaced). */
export function formatPair(symbol: string, spaced = false): string {
  const { base, quote } = splitPair(symbol);
  if (!quote) return base;
  return spaced ? `${base} / ${quote}` : `${base}/${quote}`;
}
