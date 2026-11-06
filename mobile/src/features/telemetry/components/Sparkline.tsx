import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { memo, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

interface SparklineProps {
  values: readonly number[];
  color: string;
  height?: number;
  /** Fixed number of slots so the line scrolls in from the right. */
  capacity?: number;
}

/** Filled line chart drawn with Skia (one path per update, 1 Hz). */
export const Sparkline = memo(function Sparkline({ values, color, height = 90, capacity = 60 }: SparklineProps) {
  const [width, setWidth] = useState(0);
  const { line, area } = useMemo(() => {
    const empty = Skia.PathBuilder.Make().detach();
    if (width === 0 || values.length < 2) return { line: empty, area: empty };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (capacity - 1);
    const offset = (capacity - values.length) * step;
    const pts = values.map((v, i) => ({ x: offset + i * step, y: height - 6 - ((v - min) / range) * (height - 16) }));
    const lineBuilder = Skia.PathBuilder.Make().moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) lineBuilder.lineTo(p.x, p.y);
    const line = lineBuilder.build();
    const area = lineBuilder
      .lineTo(pts[pts.length - 1]!.x, height)
      .lineTo(pts[0]!.x, height)
      .close()
      .detach();
    return { line, area };
  }, [values, width, height, capacity]);

  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Canvas style={{ width, height }}>
          <Path path={area}>
            <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[`${color}55`, `${color}00`]} />
          </Path>
          <Path path={line} style="stroke" strokeWidth={2} color={color} />
        </Canvas>
      )}
    </View>
  );
});
