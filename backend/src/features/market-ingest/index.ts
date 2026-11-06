import type { UpstreamStatus } from '@pulse/contracts';
import type { AppConfig } from '../../app/config';
import type { Logger } from '../../shared/logger';
import type { MarketEvent, MarketSource } from '../market-state';
import { BinanceStreamClient } from './binance-stream.client';
import { SyntheticFeed } from './synthetic-feed';

export { BinanceStreamClient } from './binance-stream.client';
export { SyntheticFeed } from './synthetic-feed';
export { parseCombinedFrame, buildStreamUrl } from './binance.parsers';

/** Picks the configured market source. Callers only see the MarketSource interface. */
export function createMarketSource(
  config: AppConfig,
  handlers: { onEvent: (e: MarketEvent) => void; onStatus: (s: UpstreamStatus) => void },
  logger: Logger,
): MarketSource {
  if (config.marketSource === 'synthetic') {
    return new SyntheticFeed({
      pairs: config.pairs,
      depthLevels: config.depthLevels,
      eventsPerSecond: config.synthetic.eventsPerSecond,
      ...handlers,
    });
  }
  return new BinanceStreamClient({
    url: config.binanceWsUrl,
    pairs: config.pairs,
    depthLevels: config.depthLevels,
    logger: logger.child({ feature: 'market-ingest' }),
    ...handlers,
  });
}
