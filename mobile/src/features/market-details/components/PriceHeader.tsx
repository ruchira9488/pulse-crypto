import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { formatCompact, formatPrice } from '@/core/format/number';
import { usePairChange, usePairPrice, usePairTick } from '@/features/market-stream';
import { usePairMeta } from '@/features/pairs-meta';
import { AppText, ChangeLabel, FlashingNumber } from '@/shared/ui';

export function PriceHeader({ pair }: { pair: string }) {
  const meta = usePairMeta(pair);
  const price = usePairPrice(pair) ?? meta?.lastPrice;
  const change = usePairChange(pair) ?? meta?.change24h;
  const resting = change === undefined ? colors.textPrimary : change >= 0 ? colors.up : colors.down;

  return (
    <View style={styles.container}>
      <AppText variant="label" color="textSecondary">
        LAST PRICE
      </AppText>
      <View style={styles.priceRow}>
        <FlashingNumber
          value={price}
          text={price !== undefined ? `$${formatPrice(price)}` : '—'}
          variant="monoLarge"
          color={resting}
          containerStyle={styles.priceFlash}
        />
        <ChangeLabel value={change} variant="monoMedium" />
      </View>
      <Stats pair={pair} marketCap={meta?.marketCap} />
    </View>
  );
}

function Stats({ pair, marketCap }: { pair: string; marketCap?: number }) {
  const tick = usePairTick(pair);
  const meta = usePairMeta(pair);
  const high = tick?.high24h ?? meta?.high24h;
  const low = tick?.low24h ?? meta?.low24h;
  return (
    <View style={styles.stats}>
      <Stat label="24H HIGH" value={high !== undefined ? `$${formatPrice(high)}` : '—'} />
      <Stat label="24H LOW" value={low !== undefined ? `$${formatPrice(low)}` : '—'} />
      <Stat label="MARKET CAP" value={marketCap ? formatCompact(marketCap) : '—'} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="mono">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  priceFlash: { marginLeft: -4 },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs },
});
