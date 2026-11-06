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

export interface MemoryFootprint {
  /** Live JS objects on the Hermes heap (drops after each GC). */
  liveMb: number;
  /** Heap segments reserved by the Hermes GC from the OS. */
  reservedMb: number;
  /** Native memory owned by JS objects (ArrayBuffers, external strings). */
  externalMb: number;
  /** live + external: memory the JS runtime is actually using. */
  totalMb: number;
  /** Garbage collections since the runtime started. */
  gcCount?: number;
}

type HermesStats = Record<string, unknown>;

const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);

/** Derives the memory footprint from Hermes instrumented stats. Pure for testability. */
export function parseMemoryFootprint(stats: HermesStats | undefined): MemoryFootprint | undefined {
  const live = num(stats?.js_allocatedBytes);
  if (live === undefined) return undefined;
  const external = num(stats?.js_externalBytes) ?? 0;
  return {
    liveMb: toMb(live),
    reservedMb: toMb(num(stats?.js_heapSize) ?? live),
    externalMb: toMb(external),
    totalMb: toMb(live + external),
    gcCount: num(stats?.js_numGCs),
  };
}

/** Reads the footprint from Hermes; undefined on engines without instrumented stats. */
export function readMemoryFootprint(): MemoryFootprint | undefined {
  const hermes = (globalThis as { HermesInternal?: { getInstrumentedStats?: () => HermesStats } }).HermesInternal;
  return parseMemoryFootprint(hermes?.getInstrumentedStats?.());
}
