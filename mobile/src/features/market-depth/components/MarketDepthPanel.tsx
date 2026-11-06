import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { formatCompact, formatSmallPercent } from '@/core/format/number';
import { splitPair } from '@/core/format/pair';
import { usePairTick } from '@/features/market-stream';
import { AppText } from '@/shared/ui';
import { liquidityGap, pressureLabel } from '../model/depth-curve';
import { DepthChart } from './DepthChart';

/** "MARKET DEPTH" section: legend, Skia chart and liquidity / pressure readouts. */
export function MarketDepthPanel({ pair }: { pair: string }) {
  const tick = usePairTick(pair);
  const { base } = splitPair(pair);
  if (!tick) return null;

  const bidQty = tick.bids.reduce((s, [, q]) => s + q, 0);
  const askQty = tick.asks.reduce((s, [, q]) => s + q, 0);
  const gap = liquidityGap(tick.spreadPct);
  const pressure = pressureLabel(tick.buyPressure);
  const pressureColor = pressure === 'Buy Heavy' ? colors.up : pressure === 'Sell Heavy' ? colors.down : colors.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="label" color="textSecondary">
          MARKET DEPTH
        </AppText>
        <View style={styles.legend}>
          <Legend color={colors.up} label={`Bids: ${formatCompact(bidQty, 2)} ${base}`} />
          <Legend color={colors.down} label={`Asks: ${formatCompact(askQty, 2)} ${base}`} />
        </View>
      </View>
      <View>
        <DepthChart bids={tick.bids} asks={tick.asks} />
        <View style={styles.readout}>
          <View style={styles.readoutCell}>
            <AppText variant="label" color="textSecondary">
              LIQUIDITY GAP
            </AppText>
            <AppText variant="mono" style={{ color: gap === 'Low' ? colors.up : gap === 'High' ? colors.down : colors.warning }}>
              {gap} ({formatSmallPercent(tick.spreadPct)})
            </AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.readoutCell}>
            <AppText variant="label" color="textSecondary">
              PRESSURE
            </AppText>
            <AppText variant="mono" style={{ color: pressureColor }}>
              {pressure}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="bodySmall" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.backgroundDeep },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
  legend: { flexDirection: 'row', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  readout: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
  },
  readoutCell: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
