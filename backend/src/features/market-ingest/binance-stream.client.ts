import WebSocket from 'ws';
import type { UpstreamStatus } from '@pulse/contracts';
import type { MarketEvent, MarketSource } from '../market-state';
import { Backoff } from '../../shared/backoff';
import type { Logger } from '../../shared/logger';
import { buildStreamUrl, parseCombinedFrame } from './binance.parsers';

export interface BinanceStreamOptions {
  url: string;
  pairs: readonly string[];
  depthLevels: number;
  onEvent: (event: MarketEvent) => void;
  onStatus: (status: UpstreamStatus) => void;
  logger: Logger;
  /** Reconnect if no frame arrives for this long (silent half-open sockets). */
  staleAfterMs?: number;
  /** After this many consecutive failed attempts, report "down" (still retrying). */
  downAfterAttempts?: number;
  backoff?: Backoff;
}

/**
 * One combined-stream connection to Binance carrying every subscribed pair.
 *
 * Robustness:
 * - exponential backoff with jitter on any close/error
 * - a stale-data watchdog, since a TCP connection can die without a close frame
 * - Binance's own ping frames are answered automatically by `ws`
 * - Binance drops every connection after 24h; that is just another reconnect
 */
export class BinanceStreamClient implements MarketSource {
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private watchdog?: NodeJS.Timeout;
  private lastFrameAt = 0;
  private stopped = true;
  private status: UpstreamStatus = 'connecting';
  private readonly backoff: Backoff;
  private readonly staleAfterMs: number;
  private readonly downAfterAttempts: number;
  /** Malformed or unrecognised frames, exposed for /health. */
  droppedFrames = 0;
  receivedFrames = 0;

  constructor(private readonly opts: BinanceStreamOptions) {
    this.backoff = opts.backoff ?? new Backoff(500, 30_000);
    this.staleAfterMs = opts.staleAfterMs ?? 10_000;
    this.downAfterAttempts = opts.downAfterAttempts ?? 5;
  }

  get currentStatus(): UpstreamStatus {
    return this.status;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.watchdog);
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      await new Promise<void>((resolve) => {
        socket.once('close', () => resolve());
        socket.terminate();
      });
    }
  }

  private setStatus(status: UpstreamStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.opts.onStatus(status);
  }

  private connect(): void {
    const url = buildStreamUrl(this.opts.url, this.opts.pairs, this.opts.depthLevels);
    const log = this.opts.logger;
    log.info({ url, attempt: this.backoff.attempts }, 'connecting to Binance');

    const socket = new WebSocket(url, { handshakeTimeout: 10_000 });
    this.socket = socket;

    socket.on('open', () => {
      log.info('Binance stream open');
      this.lastFrameAt = Date.now();
      this.startWatchdog();
    });

    socket.on('message', (raw) => {
      this.lastFrameAt = Date.now();
      if (this.status !== 'connected') {
        // Only consider the link healthy once data actually flows.
        this.backoff.reset();
        this.setStatus('connected');
      }
      this.receivedFrames += 1;
      let frame: unknown;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        this.droppedFrames += 1;
        return;
      }
      const event = parseCombinedFrame(frame);
      if (event) this.opts.onEvent(event);
      else this.droppedFrames += 1;
    });

    socket.on('error', (err) => {
      log.warn({ err: err.message }, 'Binance stream error');
    });

    socket.on('close', (code, reason) => {
      clearInterval(this.watchdog);
      if (this.socket === socket) this.socket = undefined;
      if (this.stopped) return;
      const delay = this.backoff.next();
      this.setStatus(this.backoff.attempts >= this.downAfterAttempts ? 'down' : 'reconnecting');
      log.warn({ code, reason: reason.toString(), retryInMs: delay }, 'Binance stream closed');
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    });
  }

  private startWatchdog(): void {
    clearInterval(this.watchdog);
    this.watchdog = setInterval(
      () => {
        if (Date.now() - this.lastFrameAt > this.staleAfterMs) {
          this.opts.logger.warn({ staleAfterMs: this.staleAfterMs }, 'Binance stream stale, forcing reconnect');
          this.socket?.terminate();
        }
      },
      Math.min(this.staleAfterMs, 2_000),
    );
    this.watchdog.unref();
  }
}
