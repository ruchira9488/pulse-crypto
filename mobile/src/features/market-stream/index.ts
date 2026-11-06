// Public API of the market-stream feature. Other features import only from here.
export { marketStream } from './market-stream.service';
export { useMarketStreamLifecycle } from './hooks/use-market-stream-lifecycle';
export {
  usePairTick,
  usePairPrice,
  usePairChange,
  usePairTimestamp,
  useOrderBook,
  useStreamPairs,
  useIsFromCache,
} from './hooks/use-market-data';
export { useConnectionStore, selectIsLive, type ConnectionState } from './store/connection.store';
export { useMarketStore } from './store/market.store';
export { streamMetrics, resetStreamMetrics } from './model/stream-metrics';
export type { ConnectionStatus } from './api/market-socket';
