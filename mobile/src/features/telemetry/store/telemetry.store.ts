import { create } from 'zustand';
import { resetStreamMetrics, streamMetrics } from '@/features/market-stream';
import { computeRates, pushBounded, readJsHeapMb, type CounterSnapshot, type Rates } from '../model/rates';

const HISTORY = 60;

interface TelemetryState extends Rates {
  jsFps: number;
  heapMb?: number;
  heapHistory: number[];
  messagesHistory: number[];
  reconnects: number;
  /** Seconds since the last socket message (0 when flowing). */
  silenceSec: number;
  reset: () => void;
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  jsFps: 0,
  messagesPerSec: 0,
  kbPerSec: 0,
  ticksPerSec: 0,
  commitsPerSec: 0,
  heapHistory: [],
  messagesHistory: [],
  reconnects: 0,
  silenceSec: 0,
  reset: () => {
    resetStreamMetrics();
    lastSnapshot = snapshot();
    set({ heapHistory: [], messagesHistory: [], reconnects: 0 });
  },
}));

let lastSnapshot: CounterSnapshot = snapshot();
let lastSampleAt = Date.now();
let frames = 0;
let sampler: ReturnType<typeof setInterval> | undefined;
let rafId: number | undefined;

function snapshot(): CounterSnapshot {
  const { messages, bytes, ticksReceived, commits } = streamMetrics;
  return { messages, bytes, ticksReceived, commits };
}

/**
 * JS-thread frame counter. Each requestAnimationFrame callback only runs when
 * the JS thread is free, so a busy thread shows up directly as a lower FPS.
 */
function countFrame() {
  frames += 1;
  rafId = requestAnimationFrame(countFrame);
}

function sample() {
  const now = Date.now();
  const elapsed = now - lastSampleAt;
  const next = snapshot();
  const rates = computeRates(lastSnapshot, next, elapsed);
  const jsFps = Math.min(60, Math.round((frames * 1000) / Math.max(elapsed, 1)));
  frames = 0;
  lastSnapshot = next;
  lastSampleAt = now;

  const heapMb = readJsHeapMb();
  const state = useTelemetryStore.getState();
  useTelemetryStore.setState({
    ...rates,
    jsFps,
    heapMb,
    heapHistory: heapMb !== undefined ? pushBounded(state.heapHistory, heapMb, HISTORY) : state.heapHistory,
    messagesHistory: pushBounded(state.messagesHistory, rates.messagesPerSec, HISTORY),
    reconnects: streamMetrics.reconnects,
    silenceSec: streamMetrics.lastMessageAt ? Math.floor((now - streamMetrics.lastMessageAt) / 1000) : 0,
  });
}

/** Starts the 1 Hz sampler (idempotent). One small store update per second. */
export function startTelemetry(): () => void {
  if (!sampler) {
    lastSnapshot = snapshot();
    lastSampleAt = Date.now();
    frames = 0;
    rafId = requestAnimationFrame(countFrame);
    sampler = setInterval(sample, 1000);
  }
  return stopTelemetry;
}

export function stopTelemetry(): void {
  if (sampler) clearInterval(sampler);
  if (rafId !== undefined) cancelAnimationFrame(rafId);
  sampler = undefined;
  rafId = undefined;
}
