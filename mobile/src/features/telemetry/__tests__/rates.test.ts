import { computeRates, pushBounded } from '../model/rates';

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
