import type { PairTick } from '@pulse/contracts';
import { TickBuffer } from '../model/tick-buffer';

const tick = (pair: string, price: number) => ({ pair, price }) as PairTick;

describe('TickBuffer', () => {
  it('conflates bursts per pair and commits once per frame', () => {
    const commits: PairTick[][] = [];
    const frames: (() => void)[] = [];
    const buffer = new TickBuffer((t) => commits.push(t), (cb) => frames.push(cb));

    for (let i = 0; i < 100; i++) buffer.push([tick('BTCUSDT', i), tick('ETHUSDT', i * 2)]);
    expect(frames).toHaveLength(1); // a single frame is scheduled for the whole burst
    expect(commits).toHaveLength(0);

    frames[0]!();
    expect(commits).toHaveLength(1);
    expect(commits[0]).toEqual([tick('BTCUSDT', 99), tick('ETHUSDT', 198)]);
  });

  it('schedules again after a flush and ignores empty pushes', () => {
    const frames: (() => void)[] = [];
    const buffer = new TickBuffer(() => {}, (cb) => frames.push(cb));
    buffer.push([]);
    expect(frames).toHaveLength(0);
    buffer.push([tick('BTCUSDT', 1)]);
    frames[0]!();
    buffer.push([tick('BTCUSDT', 2)]);
    expect(frames).toHaveLength(2);
  });

  it('flush() commits synchronously (used for snapshots)', () => {
    const commits: PairTick[][] = [];
    const buffer = new TickBuffer((t) => commits.push(t), () => {});
    buffer.push([tick('BTCUSDT', 1)]);
    buffer.flush();
    expect(commits).toHaveLength(1);
  });
});
