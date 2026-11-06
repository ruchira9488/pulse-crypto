/** Exponential backoff with equal jitter, capped. Pure, so it is unit-testable. */
export class Backoff {
  private attempt = 0;

  constructor(
    private readonly baseMs = 500,
    private readonly maxMs = 15_000,
    private readonly random: () => number = Math.random,
  ) {}

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
