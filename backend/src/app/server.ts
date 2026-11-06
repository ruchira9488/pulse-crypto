import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { AppConfig } from './config';
import type { Logger } from '../shared/logger';
import { MarketStateStore, type MarketSource } from '../features/market-state';
import { createMarketSource } from '../features/market-ingest';
import { BroadcastGateway } from '../features/broadcast';
import { PairsMetaService, registerPairsMetaRoutes } from '../features/pairs-meta';

export interface PulseServer {
  app: FastifyInstance;
  store: MarketStateStore;
  gateway: BroadcastGateway;
  source: MarketSource;
  start(): Promise<string>;
  stop(): Promise<void>;
}

/**
 * Composition root: the only place that knows about every feature.
 * Features talk to each other through small interfaces (MarketEvent, the store),
 * never by importing each other's internals.
 */
export function createServer(config: AppConfig): PulseServer {
  const app = Fastify({
    logger: { level: config.logLevel },
  });
  const logger = app.log as unknown as Logger;

  const store = new MarketStateStore(config.pairs, config.depthLevels);
  const gateway = new BroadcastGateway(config, store, logger.child({ feature: 'broadcast' }));
  const source = createMarketSource(
    config,
    {
      onEvent: (event) => store.apply(event),
      onStatus: (status) => {
        logger.info({ status }, 'upstream status');
        gateway.setUpstreamStatus(status);
      },
    },
    logger,
  );
  const meta = new PairsMetaService({
    pairs: config.pairs,
    restUrl: config.binanceRestUrl,
    cacheTtlMs: config.metaCacheTtlMs,
    store,
    logger: logger.child({ feature: 'pairs-meta' }),
  });

  void app.register(cors, { origin: true });
  registerPairsMetaRoutes(app, meta);
  app.get('/health', async () => ({
    status: 'ok',
    upstream: gateway.upstreamStatus,
    marketSource: config.marketSource,
    pairsReady: config.pairs.filter((p) => store.isReady(p)),
    ...gateway.stats(),
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  }));

  return {
    app,
    store,
    gateway,
    source,
    async start() {
      await app.ready();
      gateway.attach(app.server);
      const address = await app.listen({ host: config.host, port: config.port });
      source.start();
      return address;
    },
    async stop() {
      await source.stop();
      await gateway.close();
      await app.close();
    },
  };
}
