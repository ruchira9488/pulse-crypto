import { splitPair } from '@/core/format/pair';

const normalise = (s: string) => s.toUpperCase().replace(/[\s/\-_]/g, '');

/**
 * Case-insensitive match on symbol, base or quote, ignoring separators,
 * so "btc", "BTC/USDT", "btc usdt" and "usdt" all work.
 */
export function matchesQuery(symbol: string, query: string, displayName?: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  const { base, quote } = splitPair(symbol);
  return [symbol, base, quote, displayName ?? ''].some((s) => normalise(s).includes(q)) || normalise(`${base}${quote}`).startsWith(q);
}

export interface WatchlistFilter {
  query: string;
  favouritesOnly: boolean;
}

/** Keeps the server's order but pins favourites to the top. */
export function filterPairs(
  symbols: readonly string[],
  favourites: readonly string[],
  filter: WatchlistFilter,
  displayNames: Record<string, string | undefined> = {},
): string[] {
  const fav = new Set(favourites);
  const visible = symbols.filter(
    (s) => (!filter.favouritesOnly || fav.has(s)) && matchesQuery(s, filter.query, displayNames[s]),
  );
  return [...visible.filter((s) => fav.has(s)), ...visible.filter((s) => !fav.has(s))];
}

/** Union of known pairs, metadata order first, de-duplicated. */
export function mergePairLists(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) for (const s of list) if (!seen.has(s)) (seen.add(s), out.push(s));
  return out;
}
