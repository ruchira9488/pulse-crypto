import type { ClientConfig, ClientMessage, ServerMessage } from '@pulse/contracts';
import { Backoff } from '../model/backoff';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'paused';

/** Minimal WebSocket surface, so tests can inject a fake. */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason?: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface StatusInfo {
  status: ConnectionStatus;
  attempt: number;
  /** When a reconnect is scheduled: delay until the next attempt. */
  retryInMs?: number;
  lastCloseCode?: number;
}

export interface MarketSocketOptions {
  url: string;
  onMessage: (message: ServerMessage, byteLength: number) => void;
  onStatus: (info: StatusInfo) => void;
  onLatency?: (rttMs: number) => void;
  createSocket?: (url: string) => WebSocketLike;
  backoff?: Backoff;
  pingIntervalMs?: number;
  /** Reconnect when nothing (not even a pong) arrived for this long. */
  staleAfterMs?: number;
  now?: () => number;
}

const OPEN = 1;

/**
 * Resilient WebSocket client for the gateway.
 *
 * - Reconnects with jittered exponential backoff.
 * - Pauses retries while the device is offline (NetInfo) and reconnects
 *   immediately once connectivity returns.
 * - Closes in the background, reconnects in the foreground.
 * - Heartbeat: an app-level ping every few seconds measures RTT and doubles as
 *   a watchdog against half-open sockets that never deliver `onclose`.
 * - Re-applies the desired ClientConfig after every reconnect.
 */
export class MarketSocket {
  private socket?: WebSocketLike;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private lastMessageAt = 0;
  private pingId = 0;
  private running = false;
  private networkAvailable = true;
  private foreground = true;
  private desiredConfig?: Partial<ClientConfig>;
  private readonly backoff: Backoff;
  private readonly now: () => number;
  private readonly createSocket: (url: string) => WebSocketLike;

  constructor(private readonly opts: MarketSocketOptions) {
    this.backoff = opts.backoff ?? new Backoff();
    this.now = opts.now ?? Date.now;
    this.createSocket = opts.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect('connecting');
  }

  stop(): void {
    this.running = false;
    this.teardown();
  }

  /** Remember config and apply it now (if connected) and after every reconnect. */
  configure(config: Partial<ClientConfig>): void {
    this.desiredConfig = { ...this.desiredConfig, ...config };
    this.send({ type: 'configure', ...config });
  }

  setNetworkAvailable(available: boolean): void {
    if (available === this.networkAvailable) return;
    this.networkAvailable = available;
    if (!this.running) return;
    if (!available) {
      this.teardown();
      this.opts.onStatus({ status: 'offline', attempt: this.backoff.attempts });
    } else if (this.foreground) {
      this.backoff.reset();
      this.connect('connecting');
    }
  }

  setForeground(foreground: boolean): void {
    if (foreground === this.foreground) return;
    this.foreground = foreground;
    if (!this.running) return;
    if (!foreground) {
      this.teardown();
      this.opts.onStatus({ status: 'paused', attempt: 0 });
    } else if (this.networkAvailable) {
      this.backoff.reset();
      this.connect('connecting');
    }
  }

  /** Forces an immediate reconnect attempt (e.g. user tapped "retry"). */
  reconnectNow(): void {
    if (!this.running) return;
    this.backoff.reset();
    this.connect('connecting');
  }

  get isOpen(): boolean {
    return this.socket?.readyState === OPEN;
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify(message));
  }

  private connect(status: ConnectionStatus): void {
    this.teardown();
    if (!this.running || !this.networkAvailable || !this.foreground) return;
    this.opts.onStatus({ status, attempt: this.backoff.attempts });

    let socket: WebSocketLike;
    try {
      socket = this.createSocket(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.lastMessageAt = this.now();
      if (this.desiredConfig) this.send({ type: 'configure', ...this.desiredConfig });
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.lastMessageAt = this.now();
      if (typeof event.data !== 'string') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      if (message.type === 'hello') {
        // Healthy only once the server has actually spoken.
        this.backoff.reset();
        this.opts.onStatus({ status: 'connected', attempt: 0 });
      } else if (message.type === 'pong') {
        this.opts.onLatency?.(this.now() - message.clientTime);
      }
      this.opts.onMessage(message, event.data.length);
    };

    socket.onerror = () => {
      // onclose always follows; reconnect is handled there.
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.stopHeartbeat();
      this.scheduleReconnect(event.code);
    };
  }

  private scheduleReconnect(lastCloseCode?: number): void {
    if (!this.running || !this.networkAvailable || !this.foreground) return;
    clearTimeout(this.reconnectTimer);
    const delay = this.backoff.next();
    this.opts.onStatus({ status: 'reconnecting', attempt: this.backoff.attempts, retryInMs: delay, lastCloseCode });
    this.reconnectTimer = setTimeout(() => this.connect('reconnecting'), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = this.opts.pingIntervalMs ?? 5_000;
    const staleAfter = this.opts.staleAfterMs ?? 12_000;
    this.sendPing();
    this.pingTimer = setInterval(() => {
      if (this.now() - this.lastMessageAt > staleAfter) {
        // Half-open: drop it and go through the normal reconnect path.
        const socket = this.socket;
        this.socket = undefined;
        this.stopHeartbeat();
        socket?.close(4000, 'stale');
        this.scheduleReconnect(4000);
        return;
      }
      this.sendPing();
    }, interval);
  }

  private sendPing(): void {
    this.send({ type: 'ping', id: ++this.pingId, clientTime: this.now() });
  }

  private stopHeartbeat(): void {
    clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  private teardown(): void {
    clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try {
        socket.close(1000, 'client teardown');
      } catch {
        // already closed
      }
    }
  }
}
