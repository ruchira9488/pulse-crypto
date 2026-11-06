import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { formatClock, formatPercent, formatPrice } from '@/core/format/number';
import { useConnectionStore, usePairTick } from '@/features/market-stream';
import { AppText } from '@/shared/ui';
import { PressureBar } from './PressureBar';

/** Spread, buy/sell pressure and last-updated time for the selected pair. */
export function MarketStats({ pair }: { pair: string }) {
  const tick = usePairTick(pair);
  const live = useConnectionStore((s) => s.status === 'connected');
  if (!tick) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View>
          <AppText variant="label" color="textSecondary">
            SPREAD
          </AppText>
          <AppText variant="mono">
            {formatPrice(tick.spread, Math.max(2, decimalsOf(tick.bestBid)))}{' '}
            <AppText variant="bodySmall" color="textMuted">
              ({formatPercent(tick.spreadPct, 4)})
            </AppText>
          </AppText>
        </View>
        <View style={styles.right}>
          <AppText variant="label" color="textSecondary">
            LAST UPDATED
          </AppText>
          <AppText variant="mono" style={{ color: live ? colors.textPrimary : colors.warning }}>
            {formatClock(tick.timestamp)}
          </AppText>
        </View>
      </View>
      <PressureBar buy={tick.buyPressure} sell={tick.sellPressure} />
    </View>
  );
}

/** Decimal places used by a price, so the spread is shown at the book's precision. */
function decimalsOf(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  right: { alignItems: 'flex-end' },
});
