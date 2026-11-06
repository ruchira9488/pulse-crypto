import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, spacing } from '@/core/theme';
import { AppText } from '@/shared/ui';

/** Two-sided buy/sell pressure bar; the split animates on the UI thread. */
export function PressureBar({ buy, sell }: { buy: number; sell: number }) {
  const share = useSharedValue(buy);
  useEffect(() => {
    share.value = withTiming(buy, { duration: 300 });
  }, [buy, share]);
  const buyStyle = useAnimatedStyle(() => ({ flexGrow: share.value }));
  const sellStyle = useAnimatedStyle(() => ({ flexGrow: 100 - share.value }));

  return (
    <View style={styles.container} accessibilityLabel={`Buy pressure ${buy.toFixed(0)} percent, sell pressure ${sell.toFixed(0)} percent`}>
      <View style={styles.labels}>
        <AppText variant="label" style={{ color: colors.up }}>
          BUY {buy.toFixed(1)}%
        </AppText>
        <AppText variant="label" style={{ color: colors.down }}>
          {sell.toFixed(1)}% SELL
        </AppText>
      </View>
      <View style={styles.bar}>
        <Animated.View style={[styles.segment, { backgroundColor: colors.up }, buyStyle]} />
        <View style={styles.gap} />
        <Animated.View style={[styles.segment, { backgroundColor: colors.down }, sellStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: { flexDirection: 'row', height: 6 },
  segment: { flexBasis: 0, height: '100%' },
  gap: { width: 2 },
});
