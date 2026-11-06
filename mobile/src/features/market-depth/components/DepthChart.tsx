import { Canvas, Line, LinearGradient, Path, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import type { BookLevel } from '@pulse/contracts';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, palette } from '@/core/theme';
import { computeDepthCurve } from '../model/depth-curve';

const SAMPLES = 24;
const HEIGHT = 190;
const TOP_PADDING = 0.18; // leave headroom for the overlay labels

interface DepthChartProps {
  bids: readonly BookLevel[];
  asks: readonly BookLevel[];
  height?: number;
}

function lerp(from: number[], to: number[], t: number): number[] {
  'worklet';
  const out = new Array<number>(to.length);
  for (let i = 0; i < to.length; i++) out[i] = (from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * t;
  return out;
}

/** Smooth filled area through `points` between x0..x1, closed to the baseline. */
function buildArea(points: number[], x0: number, x1: number, height: number): SkPath {
  'worklet';
  const path = Skia.PathBuilder.Make();
  const n = points.length;
  const usable = height * (1 - TOP_PADDING);
  const xAt = (i: number) => x0 + ((x1 - x0) * i) / (n - 1);
  const yAt = (i: number) => height - (points[i] ?? 0) * usable;
  path.moveTo(x0, height);
  path.lineTo(xAt(0), yAt(0));
  for (let i = 1; i < n; i++) {
    const xa = xAt(i - 1);
    const xb = xAt(i);
    const mid = (xa + xb) / 2;
    // Horizontal-tangent cubic: smooth S-curves, never overshoots between samples.
    path.cubicTo(mid, yAt(i - 1), mid, yAt(i), xb, yAt(i));
  }
  path.lineTo(x1, height);
  path.close();
  return path.detach();
}

/**
 * Cumulative market depth: bids (green) left of centre, asks (red) right.
 *
 * Each update re-samples the book to a fixed number of points; the chart then
 * tweens from the curve currently on screen to the new one. The tween and path
 * building run as worklets on the UI thread, so depth changes animate smoothly
 * even while the JS thread is handling a burst of ticks.
 */
export const DepthChart = memo(function DepthChart({ bids, asks, height = HEIGHT }: DepthChartProps) {
  const [width, setWidth] = useState(0);
  const curve = useMemo(() => computeDepthCurve(bids, asks, SAMPLES), [bids, asks]);

  const fromBids = useSharedValue<number[]>(curve.bids);
  const toBids = useSharedValue<number[]>(curve.bids);
  const fromAsks = useSharedValue<number[]>(curve.asks);
  const toAsks = useSharedValue<number[]>(curve.asks);
  const progress = useSharedValue(1);

  useEffect(() => {
    // Start the new tween from wherever the previous one currently is.
    fromBids.value = lerp(fromBids.value, toBids.value, progress.value);
    fromAsks.value = lerp(fromAsks.value, toAsks.value, progress.value);
    toBids.value = curve.bids;
    toAsks.value = curve.asks;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 280 });
  }, [curve, fromBids, toBids, fromAsks, toAsks, progress]);

  const mid = width / 2;
  const bidPath = useDerivedValue(
    () => buildArea(lerp(fromBids.value, toBids.value, progress.value), 0, mid, height),
    [mid, height],
  );
  const askPath = useDerivedValue(
    () => buildArea(lerp(fromAsks.value, toAsks.value, progress.value), mid, width, height),
    [mid, width, height],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout} accessibilityLabel="Market depth chart">
      {width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={bidPath}>
            <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[palette.secondary[700], colors.bidArea]} />
          </Path>
          <Path path={askPath}>
            <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[palette.tertiary[700], colors.askArea]} />
          </Path>
          <Line p1={vec(mid, 0)} p2={vec(mid, height)} color={colors.textMuted} strokeWidth={1} opacity={0.6} />
        </Canvas>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: colors.backgroundDeep, overflow: 'hidden' },
});
