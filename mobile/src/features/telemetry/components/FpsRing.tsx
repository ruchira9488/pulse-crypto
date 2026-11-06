import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '@/core/theme';
import { AppText } from '@/shared/ui';

const SIZE = 132;
const STROKE = 10;

/** Ring gauge for the JS frame rate (Skia arc, animated on the UI thread). */
export function FpsRing({ fps }: { fps: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.min(1, fps / 60), { duration: 400 });
  }, [fps, progress]);

  const track = useMemo(() => {
    return Skia.PathBuilder.Make()
      .addCircle(SIZE / 2, SIZE / 2, (SIZE - STROKE) / 2)
      .detach();
  }, []);

  const arc = useDerivedValue(() => {
    const r = (SIZE - STROKE) / 2;
    return Skia.PathBuilder.Make()
      .addArc({ x: STROKE / 2, y: STROKE / 2, width: r * 2, height: r * 2 }, -90, 360 * progress.value)
      .detach();
  });

  const color = fps >= 50 ? colors.up : fps >= 30 ? colors.warning : colors.down;

  return (
    <View style={styles.wrap} accessibilityLabel={`JS thread frame rate ${fps} FPS`}>
      <Canvas style={styles.canvas}>
        <Path path={track} style="stroke" strokeWidth={STROKE} color={colors.surfaceRaised} />
        <Path path={arc} style="stroke" strokeWidth={STROKE} strokeCap="round" color={color} />
      </Canvas>
      <View style={styles.center}>
        <AppText variant="monoLarge">{fps}</AppText>
        <AppText variant="label" color="textSecondary">
          FPS
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
  canvas: { width: SIZE, height: SIZE },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
