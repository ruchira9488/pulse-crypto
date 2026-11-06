/**
 * Exponential backoff with "equal jitter" (50–100% of the ceiling), so that many
 * gateways (or many app instances) don't reconnect in lock-step.
 */
export class Backoff {
  private attempt = 0;

  constructor(
    private readonly baseMs = 500,
    private readonly maxMs = 30_000,
    private readonly random: () => number = Math.random,
  ) {}

  /** Delay before the next attempt; increments the attempt counter. */
  next(): number {
    const ceiling = Math.min(this.maxMs, this.baseMs * 2 ** this.attempt);
    this.attempt += 1;
    return Math.round(ceiling * (0.5 + this.random() * 0.5));
  }

  reset(): void {
    this.attempt = 0;
  }

  get attempts(): number {
    return this.attempt;
  }
}
