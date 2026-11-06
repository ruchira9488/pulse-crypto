import { useShallow } from 'zustand/react/shallow';
import { useConnectionStore } from '@/features/market-stream';
import { describeConnection, type ConnectionView } from '../model/connection-view';

export function useConnectionView(): ConnectionView {
  const { status, upstream, retryInMs } = useConnectionStore(
    useShallow((s) => ({ status: s.status, upstream: s.upstream, retryInMs: s.retryInMs })),
  );
  return describeConnection(status, upstream, retryInMs);
}
