import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, spacing } from '@/core/theme';
import { formatFixed, formatPrice, formatQuantity } from '@/core/format/number';
import { AppText } from '@/shared/ui';

export const BOOK_ROW_HEIGHT = 32;

interface OrderBookRowProps {
  side: 'bid' | 'ask';
  price: number;
  quantity: number;
  /** 0..1, this level's notional relative to the largest level on the same side. */
  ratio: number;
  priceDecimals: number;
}

/**
 * One price level. Memoised on primitive props: unchanged levels skip render.
 * The depth bar's width animates on the UI thread, so volume changes glide
 * instead of jumping.
 */
export const OrderBookRow = memo(function OrderBookRow({ side, price, quantity, ratio, priceDecimals }: OrderBookRowProps) {
  const width = useSharedValue(ratio);
  useEffect(() => {
    width.value = withTiming(ratio, { duration: 220 });
  }, [ratio, width]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const isBid = side === 'bid';

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.bar, { backgroundColor: isBid ? colors.bidDepth : colors.askDepth }, barStyle]} />
      <AppText variant="mono" style={[styles.price, { color: isBid ? colors.up : colors.down }]}>
        {formatPrice(price, priceDecimals)}
      </AppText>
      <AppText variant="mono" style={styles.qty}>
        {formatQuantity(quantity)}
      </AppText>
      <AppText variant="mono" style={styles.total}>
        {formatFixed(price * quantity, 2)}
      </AppText>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    height: BOOK_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  bar: { position: 'absolute', right: 0, top: 1, bottom: 1 },
  price: { flex: 1.1 },
  qty: { flex: 1, textAlign: 'center', color: colors.textPrimary },
  total: { flex: 1.1, textAlign: 'right', color: colors.textPrimary },
});
