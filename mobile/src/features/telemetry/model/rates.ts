export interface CounterSnapshot {
  messages: number;
  bytes: number;
  ticksReceived: number;
  commits: number;
}

export interface Rates {
  messagesPerSec: number;
  kbPerSec: number;
  ticksPerSec: number;
  commitsPerSec: number;
}

/** Per-second rates between two counter snapshots. Pure for testability. */
export function computeRates(prev: CounterSnapshot, next: CounterSnapshot, elapsedMs: number): Rates {
  const secs = Math.max(elapsedMs, 1) / 1000;
  const rate = (a: number, b: number) => Math.max(0, b - a) / secs;
  return {
    messagesPerSec: Math.round(rate(prev.messages, next.messages)),
    kbPerSec: Math.round((rate(prev.bytes, next.bytes) / 1024) * 10) / 10,
    ticksPerSec: Math.round(rate(prev.ticksReceived, next.ticksReceived)),
    commitsPerSec: Math.round(rate(prev.commits, next.commits)),
  };
}

/** Appends to a fixed-size history without growing unbounded. */
export function pushBounded<T>(list: readonly T[], value: T, max: number): T[] {
  const next = list.length >= max ? list.slice(list.length - max + 1) : list.slice();
  next.push(value);
  return next;
}

/** Hermes exposes heap statistics; returns MB or undefined on other engines. */
export function readJsHeapMb(): number | undefined {
  const hermes = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => Record<string, number> } }).HermesInternal;
  const stats = hermes?.getInstrumentedStats?.();
  const bytes = stats?.js_heapSize ?? stats?.js_allocatedBytes;
  return typeof bytes === 'number' ? Math.round((bytes / 1024 / 1024) * 10) / 10 : undefined;
}
