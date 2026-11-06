import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Pulsing dot (UI-thread animation, zero JS work per frame). */
export function StatusDot({ color, pulsing, size = 8 }: { color: string; pulsing: boolean; size?: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (pulsing) {
      opacity.value = withRepeat(withTiming(0.25, { duration: 800 }), -1, true);
    } else {
      cancelAnimation(opacity);
      opacity.value = 1;
    }
  }, [pulsing, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}
