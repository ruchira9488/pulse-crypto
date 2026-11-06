import type { PairTick } from '@pulse/contracts';

export type FrameScheduler = (cb: () => void) => unknown;

/**
 * Client-side conflation, the mirror of the gateway's strategy.
 *
 * Socket frames may arrive faster than the screen refreshes (the user can pick
 * a 10ms interval). Each incoming tick overwrites the pending tick for its pair,
 * and pending ticks are committed to the store once per animation frame.
 * React therefore sees at most one state change per frame, however bursty
 * the socket is, and stale intermediate values are never rendered.
 */
export class TickBuffer {
  private pending = new Map<string, PairTick>();
  private scheduled = false;

  constructor(
    private readonly commit: (ticks: PairTick[]) => void,
    private readonly schedule: FrameScheduler = requestAnimationFrame,
  ) {}

  push(ticks: readonly PairTick[]): void {
    for (const tick of ticks) this.pending.set(tick.pair, tick);
    if (!this.scheduled && this.pending.size > 0) {
      this.scheduled = true;
      this.schedule(() => this.flush());
    }
  }

  /** Commits immediately (also used by tests and on snapshot). */
  flush(): void {
    this.scheduled = false;
    if (this.pending.size === 0) return;
    const batch = [...this.pending.values()];
    this.pending = new Map();
    this.commit(batch);
  }

  clear(): void {
    this.pending.clear();
  }
}
