import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '@/core/theme';

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  color: string;
  trackColor?: string;
  height?: number;
}

/** Width animates on the UI thread, so it stays smooth while the JS thread is busy. */
export function ProgressBar({ value, color, trackColor = colors.surfaceRaised, height = 6 }: ProgressBarProps) {
  const progress = useSharedValue(value);
  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 300 });
  }, [value, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
