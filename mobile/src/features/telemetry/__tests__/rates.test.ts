import { computeRates, parseMemoryFootprint, pushBounded } from '../model/rates';

describe('computeRates', () => {
  it('computes per-second rates over the elapsed window', () => {
    const r = computeRates(
      { messages: 0, bytes: 0, ticksReceived: 0, commits: 0 },
      { messages: 20, bytes: 20480, ticksReceived: 50, commits: 18 },
      2000,
    );
    expect(r).toEqual({ messagesPerSec: 10, kbPerSec: 10, ticksPerSec: 25, commitsPerSec: 9 });
  });

  it('never reports negative rates after a counter reset', () => {
    const r = computeRates({ messages: 50, bytes: 0, ticksReceived: 0, commits: 0 }, { messages: 0, bytes: 0, ticksReceived: 0, commits: 0 }, 1000);
    expect(r.messagesPerSec).toBe(0);
  });
});

describe('pushBounded', () => {
  it('keeps at most max items, dropping the oldest', () => {
    expect(pushBounded([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
    expect(pushBounded([], 1, 3)).toEqual([1]);
  });
});

describe('parseMemoryFootprint', () => {
  const MB = 1024 * 1024;

  it('sums live heap and external memory, and reports the reserved heap separately', () => {
    const m = parseMemoryFootprint({ js_allocatedBytes: 30 * MB, js_externalBytes: 0.5 * MB, js_heapSize: 48 * MB, js_numGCs: 179 });
    expect(m).toEqual({ liveMb: 30, externalMb: 0.5, reservedMb: 48, totalMb: 30.5, gcCount: 179 });
  });

  it('treats missing external and reserved figures conservatively', () => {
    expect(parseMemoryFootprint({ js_allocatedBytes: 10 * MB })).toEqual({ liveMb: 10, externalMb: 0, reservedMb: 10, totalMb: 10, gcCount: undefined });
  });

  it('returns undefined when the engine exposes no stats', () => {
    expect(parseMemoryFootprint(undefined)).toBeUndefined();
    expect(parseMemoryFootprint({ js_heapSize: 48 * MB })).toBeUndefined();
  });
});
