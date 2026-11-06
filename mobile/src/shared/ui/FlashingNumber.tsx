import { memo, useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, typography, type TypographyVariant } from '@/core/theme';

interface FlashingNumberProps {
  value: number | undefined;
  text: string;
  variant?: TypographyVariant;
  /** Resting text colour. */
  color?: string;
  /** Keep the up/down colour after the flash fades (e.g. the big last price). */
  holdDirectionColor?: boolean;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  durationMs?: number;
}

/**
 * Briefly highlights green/red when `value` rises/falls.
 * The fade runs entirely on the UI thread (Reanimated), so a busy JS thread
 * cannot make it stutter; JS only pays for the text change itself.
 */
export const FlashingNumber = memo(function FlashingNumber({
  value,
  text,
  variant = 'monoMedium',
  color = colors.textPrimary,
  holdDirectionColor = false,
  style,
  containerStyle,
  durationMs = 650,
}: FlashingNumberProps) {
  const previous = useRef(value);
  const flash = useSharedValue(0);
  const direction = useSharedValue(0); // 1 up, -1 down, 0 none

  useEffect(() => {
    const prev = previous.current;
    previous.current = value;
    if (prev === undefined || value === undefined || prev === value) return;
    direction.value = value > prev ? 1 : -1;
    flash.value = 1;
    flash.value = withTiming(0, { duration: durationMs });
  }, [value, direction, flash, durationMs]);

  const background = useAnimatedStyle(() => ({
    backgroundColor:
      direction.value > 0
        ? interpolateColor(flash.value, [0, 1], ['rgba(0,197,122,0)', colors.upFlash])
        : interpolateColor(flash.value, [0, 1], ['rgba(255,59,105,0)', colors.downFlash]),
  }));

  const textColor = useAnimatedStyle(() => {
    const target = direction.value > 0 ? colors.up : direction.value < 0 ? colors.down : color;
    const rest = holdDirectionColor && direction.value !== 0 ? target : color;
    return { color: interpolateColor(flash.value, [0, 1], [rest, target]) };
  });

  return (
    <Animated.View style={[styles.container, background, containerStyle]}>
      <Animated.Text allowFontScaling={false} style={[typography[variant], textColor, style]} numberOfLines={1}>
        {text}
      </Animated.Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4, borderRadius: 3 },
});
