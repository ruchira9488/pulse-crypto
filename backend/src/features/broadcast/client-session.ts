import type { ClientConfig, ServerMessage } from '@pulse/contracts';
import type { MarketStateStore } from '../market-state';

/** The subset of a `ws` WebSocket the session needs; lets tests use a fake. */
export interface SessionSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string, options: { compress: boolean }): void;
  close(code: number, reason: string): void;
  terminate(): void;
}

/** Grace period for the close handshake before a congested socket is destroyed. */
const SLOW_CONSUMER_TERMINATE_AFTER_MS = 1_000;

export interface SessionLimits {
  minIntervalMs: number;
  maxIntervalMs: number;
  highWaterMarkBytes: number;
  maxBufferedBytes: number;
  slowConsumerTimeoutMs: number;
}

export interface SessionStats {
  framesSent: number;
  framesSkipped: number;
  bytesSent: number;
}

const OPEN = 1;
/** Close code 1013 = "Try Again Later"; clients should reconnect with backoff. */
export const SLOW_CONSUMER_CLOSE_CODE = 1013;
/** Healthy flushes required before an adaptive client is stepped back down. */
const RECOVERY_FLUSHES = 10;

/**
 * Per-client delivery loop.
 *
 * The session never queues ticks. Every `effectiveIntervalMs` it asks the
 * shared store which pairs changed since it last sent them (version compare)
 * and writes one batched frame with only those pairs.
 *
 * Back-pressure is driven by the socket's `bufferedAmount` (bytes the kernel
 * hasn't accepted yet):
 *   - above the high-water mark the frame is skipped. Nothing is lost, since the
 *     next frame carries the newest state anyway;
 *   - above `maxBufferedBytes`, or stuck above high-water for longer than
 *     `slowConsumerTimeoutMs`, the client is disconnected with 1013.
 * So the memory one slow client can pin is bounded by `maxBufferedBytes`.
 *
 * With `adaptive` on, a client that falls behind has its interval doubled
 * (up to the max) and stepped back down once it keeps up again.
 */
export class ClientSession {
  readonly stats: SessionStats = { framesSent: 0, framesSkipped: 0, bytesSent: 0 };
  config: ClientConfig;
  effectiveIntervalMs: number;

  private readonly sentVersions = new Map<string, number>();
  private seq = 0;
  private timer?: NodeJS.Timeout;
  private congestedSince?: number;
  private healthyFlushes = 0;
  private closed = false;

  constructor(
    readonly id: string,
    private readonly socket: SessionSocket,
    private readonly store: MarketStateStore,
    private readonly limits: SessionLimits,
    initial: ClientConfig,
    private readonly now: () => number = Date.now,
    private readonly onSlowConsumer: (session: ClientSession) => void = () => {},
  ) {
    this.config = { ...initial, intervalMs: this.clamp(initial.intervalMs) };
    this.effectiveIntervalMs = this.config.intervalMs;
  }

  /** Sends the full current state of every ready pair, then starts the loop. */
  start(): void {
    const parts: string[] = [];
    for (const pair of this.store.pairs) {
      const json = this.store.getTickJson(pair);
      if (json) {
        parts.push(json);
        this.sentVersions.set(pair, this.store.version(pair));
      }
    }
    this.writeRaw(`{"type":"snapshot","seq":${++this.seq},"serverTime":${this.now()},"data":[${parts.join(',')}]}`);
    this.schedule();
  }

  stop(): void {
    this.closed = true;
    clearTimeout(this.timer);
  }

  configure(patch: Partial<ClientConfig>): ClientConfig {
    if (patch.intervalMs !== undefined) {
      this.config.intervalMs = this.clamp(patch.intervalMs);
      this.effectiveIntervalMs = this.config.intervalMs;
      this.healthyFlushes = 0;
      // Apply the new cadence immediately rather than after the old interval.
      this.schedule();
    }
    if (patch.adaptive !== undefined) {
      this.config.adaptive = patch.adaptive;
      if (!patch.adaptive) this.effectiveIntervalMs = this.config.intervalMs;
    }
    if (patch.compress !== undefined) this.config.compress = patch.compress;
    return { ...this.config };
  }

  send(message: ServerMessage): void {
    this.writeRaw(JSON.stringify(message));
  }

  /** One delivery attempt. Public so tests can drive it without timers. */
  flush(): void {
    if (this.socket.readyState !== OPEN) return;
    const buffered = this.socket.bufferedAmount;

    if (buffered > this.limits.maxBufferedBytes) {
      this.disconnectSlow(`buffer ${buffered}B exceeds limit`);
      return;
    }

    if (buffered > this.limits.highWaterMarkBytes) {
      const now = this.now();
      this.congestedSince ??= now;
      if (now - this.congestedSince > this.limits.slowConsumerTimeoutMs) {
        this.disconnectSlow(`congested for ${now - this.congestedSince}ms`);
        return;
      }
      this.stats.framesSkipped += 1;
      this.healthyFlushes = 0;
      if (this.config.adaptive) {
        this.effectiveIntervalMs = Math.min(this.limits.maxIntervalMs, this.effectiveIntervalMs * 2);
      }
      return;
    }

    this.congestedSince = undefined;
    if (this.config.adaptive && this.effectiveIntervalMs > this.config.intervalMs) {
      this.healthyFlushes += 1;
      if (this.healthyFlushes >= RECOVERY_FLUSHES) {
        this.healthyFlushes = 0;
        this.effectiveIntervalMs = Math.max(this.config.intervalMs, Math.round(this.effectiveIntervalMs / 2));
      }
    }

    const parts: string[] = [];
    for (const pair of this.store.pairs) {
      const version = this.store.version(pair);
      if (version === this.sentVersions.get(pair)) continue;
      const json = this.store.getTickJson(pair);
      if (!json) continue;
      parts.push(json);
      this.sentVersions.set(pair, version);
    }
    if (parts.length === 0) return;

    // Hand-assembled so each pair's JSON (cached in the store) is reused by every client.
    this.writeRaw(
      `{"type":"update","seq":${++this.seq},"serverTime":${this.now()},"effectiveIntervalMs":${this.effectiveIntervalMs},"data":[${parts.join(',')}]}`,
    );
  }

  private writeRaw(data: string): void {
    if (this.socket.readyState !== OPEN) return;
    this.socket.send(data, { compress: this.config.compress });
    this.stats.framesSent += 1;
    this.stats.bytesSent += data.length;
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.closed) return;
    this.timer = setTimeout(() => {
      this.flush();
      this.schedule();
    }, this.effectiveIntervalMs);
  }

  private disconnectSlow(reason: string): void {
    this.stop();
    this.onSlowConsumer(this);
    this.socket.close(SLOW_CONSUMER_CLOSE_CODE, `slow consumer: ${reason}`.slice(0, 120));
    // The close frame is queued behind the backlog a slow client isn't reading,
    // so the handshake may never finish. Free the socket and its buffer regardless.
    setTimeout(() => this.socket.terminate(), SLOW_CONSUMER_TERMINATE_AFTER_MS).unref();
  }

  private clamp(ms: number): number {
    if (!Number.isFinite(ms)) return this.limits.minIntervalMs;
    return Math.min(this.limits.maxIntervalMs, Math.max(this.limits.minIntervalMs, Math.round(ms)));
  }
}
