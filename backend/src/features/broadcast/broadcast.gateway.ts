import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION, type UpstreamStatus } from '@pulse/contracts';
import type { AppConfig } from '../../app/config';
import type { Logger } from '../../shared/logger';
import type { MarketStateStore } from '../market-state';
import { parseClientMessage } from './client-protocol';
import { ClientSession } from './client-session';

export interface GatewayStats {
  clients: number;
  totalConnections: number;
  slowConsumerDisconnects: number;
  framesSent: number;
  framesSkipped: number;
}

interface Connection {
  socket: WebSocket;
  session: ClientSession;
  alive: boolean;
}

/**
 * WebSocket fan-out at `/ws`. Owns connection lifecycle (upgrade, heartbeat,
 * inbound messages); per-client delivery lives in ClientSession.
 */
export class BroadcastGateway {
  private readonly wss: WebSocketServer;
  private readonly connections = new Set<Connection>();
  private heartbeat?: NodeJS.Timeout;
  private upstream: UpstreamStatus = 'connecting';
  private nextId = 1;
  private totals = { totalConnections: 0, slowConsumerDisconnects: 0, framesSent: 0, framesSkipped: 0 };

  constructor(
    private readonly config: AppConfig,
    private readonly store: MarketStateStore,
    private readonly logger: Logger,
  ) {
    this.wss = new WebSocketServer({
      noServer: true,
      // Client messages are tiny control frames; anything large is abuse.
      maxPayload: 4 * 1024,
      perMessageDeflate: {
        // Level 1: most of the size win for a fraction of the CPU.
        zlibDeflateOptions: { level: 1 },
        // Tiny frames (pongs, acks) aren't worth compressing.
        threshold: 512,
      },
    });
  }

  /** Hooks into an existing HTTP server so REST and WS share one port. */
  attach(server: Server): void {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const path = (req.url ?? '').split('?')[0];
      if (path !== '/ws') {
        socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
        return;
      }
      if (this.connections.size >= this.config.broadcast.maxClients) {
        socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws, req));
    });

    this.heartbeat = setInterval(() => this.checkHeartbeats(), this.config.broadcast.heartbeatIntervalMs);
    this.heartbeat.unref();
  }

  setUpstreamStatus(status: UpstreamStatus): void {
    if (status === this.upstream) return;
    this.upstream = status;
    for (const c of this.connections) c.session.send({ type: 'upstream', status });
  }

  get upstreamStatus(): UpstreamStatus {
    return this.upstream;
  }

  stats(): GatewayStats {
    let framesSent = this.totals.framesSent;
    let framesSkipped = this.totals.framesSkipped;
    for (const c of this.connections) {
      framesSent += c.session.stats.framesSent;
      framesSkipped += c.session.stats.framesSkipped;
    }
    return {
      clients: this.connections.size,
      totalConnections: this.totals.totalConnections,
      slowConsumerDisconnects: this.totals.slowConsumerDisconnects,
      framesSent,
      framesSkipped,
    };
  }

  async close(): Promise<void> {
    clearInterval(this.heartbeat);
    for (const c of this.connections) {
      c.session.stop();
      c.socket.close(1001, 'server shutting down');
    }
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  private onConnection(socket: WebSocket, req: IncomingMessage): void {
    const id = `c${this.nextId++}`;
    const log = this.logger.child({ client: id });
    const b = this.config.broadcast;
    const compressionAvailable = socket.extensions.includes('permessage-deflate');

    const session = new ClientSession(
      id,
      socket,
      this.store,
      b,
      { intervalMs: b.defaultIntervalMs, adaptive: false, compress: compressionAvailable },
      Date.now,
      () => {
        this.totals.slowConsumerDisconnects += 1;
        log.warn('disconnecting slow consumer');
      },
    );
    const conn: Connection = { socket, session, alive: true };
    this.connections.add(conn);
    this.totals.totalConnections += 1;
    log.info({ remote: req.socket.remoteAddress, compressionAvailable, clients: this.connections.size }, 'client connected');

    socket.on('pong', () => {
      conn.alive = true;
    });

    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        session.send({ type: 'error', code: 'unsupported', message: 'binary frames are not supported' });
        return;
      }
      const parsed = parseClientMessage(data.toString());
      if (!parsed.ok) {
        session.send({ type: 'error', code: 'bad_request', message: parsed.error });
        return;
      }
      const msg = parsed.message;
      if (msg.type === 'ping') {
        session.send({ type: 'pong', id: msg.id, clientTime: msg.clientTime, serverTime: Date.now() });
      } else {
        const { type: _type, ...patch } = msg;
        const config = session.configure(patch);
        log.info({ config }, 'client reconfigured');
        session.send({ type: 'config', config });
      }
    });

    socket.on('close', (code) => {
      session.stop();
      this.connections.delete(conn);
      this.totals.framesSent += session.stats.framesSent;
      this.totals.framesSkipped += session.stats.framesSkipped;
      log.info({ code, clients: this.connections.size, ...session.stats }, 'client disconnected');
    });

    socket.on('error', (err) => log.warn({ err: err.message }, 'client socket error'));

    session.send({
      type: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      serverTime: Date.now(),
      pairs: [...this.store.pairs],
      config: { ...session.config },
      compressionAvailable,
      upstream: this.upstream,
    });
    session.start();
  }

  /** Terminates sockets that didn't answer the previous ping (dead mobile links). */
  private checkHeartbeats(): void {
    for (const c of this.connections) {
      if (!c.alive) {
        c.socket.terminate();
        continue;
      }
      c.alive = false;
      c.socket.ping();
    }
  }
}
