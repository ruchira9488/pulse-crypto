/**
 * Hot-path counters, deliberately *not* React state: incrementing them on every
 * message must not trigger renders. The telemetry feature samples them on a timer.
 */
export const streamMetrics = {
  messages: 0,
  bytes: 0,
  ticksReceived: 0,
  /** Store commits (at most one per animation frame). */
  commits: 0,
  reconnects: 0,
  lastMessageAt: 0,
};

export type StreamMetrics = typeof streamMetrics;

export function resetStreamMetrics(): void {
  streamMetrics.messages = 0;
  streamMetrics.bytes = 0;
  streamMetrics.ticksReceived = 0;
  streamMetrics.commits = 0;
  streamMetrics.reconnects = 0;
}
