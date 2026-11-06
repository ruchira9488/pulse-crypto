import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { formatCompact, formatPrice } from '@/core/format/number';
import { formatPair } from '@/core/format/pair';
import { FavouriteToggle } from '@/features/favourites';
import { StatusDot } from '@/features/connection';
import { selectIsLive, useConnectionStore, usePairChange, usePairPrice } from '@/features/market-stream';
import { usePairMeta } from '@/features/pairs-meta';
import { AppText, ChangeLabel, FlashingNumber } from '@/shared/ui';

export const ROW_HEIGHT = 68;

/**
 * One row = several tiny subscribers. Price, change and the live dot each
 * subscribe to exactly the field they render, so a tick re-renders only the
 * parts that changed, and only for this pair.
 */
export const WatchlistRow = memo(function WatchlistRow({ symbol, onPress }: { symbol: string; onPress: (s: string) => void }) {
  const handlePress = useCallback(() => onPress(symbol), [onPress, symbol]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${formatPair(symbol, true)} market details`}
    >
      <FavouriteToggle symbol={symbol} />
      <View style={styles.name}>
        <AppText variant="subheading">{formatPair(symbol, true)}</AppText>
        <VolumeCaption symbol={symbol} />
      </View>
      <View style={styles.right}>
        <RowPrice symbol={symbol} />
        <RowChange symbol={symbol} />
      </View>
      <RowLiveDot symbol={symbol} />
    </Pressable>
  );
});

function RowPrice({ symbol }: { symbol: string }) {
  const live = usePairPrice(symbol);
  const fallback = usePairMeta(symbol)?.lastPrice;
  const price = live ?? fallback;
  return <FlashingNumber value={price} text={price !== undefined ? formatPrice(price) : '—'} variant="monoMedium" />;
}

function RowChange({ symbol }: { symbol: string }) {
  const live = usePairChange(symbol);
  const fallback = usePairMeta(symbol)?.change24h;
  return <ChangeLabel value={live ?? fallback} variant="mono" />;
}

function VolumeCaption({ symbol }: { symbol: string }) {
  const meta = usePairMeta(symbol);
  if (!meta) return <AppText variant="bodySmall" color="textMuted">Vol —</AppText>;
  return (
    <AppText variant="bodySmall" color="textMuted">
      Vol {formatCompact(meta.volume24h)} {meta.baseAsset}
    </AppText>
  );
}

/** Green pulse while this pair streams live; grey when the stream is down or the pair has no data. */
function RowLiveDot({ symbol }: { symbol: string }) {
  const isLive = useConnectionStore(selectIsLive);
  const hasData = usePairPrice(symbol) !== undefined;
  const live = isLive && hasData;
  return (
    <View accessibilityLabel={live ? 'Live' : 'Not live'} style={styles.dot}>
      <StatusDot color={live ? colors.up : colors.textDisabled} pulsing={live} size={8} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.surface },
  name: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  dot: { width: 12, alignItems: 'center' },
});
