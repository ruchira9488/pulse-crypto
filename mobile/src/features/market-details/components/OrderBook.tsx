import type { BookLevel } from '@pulse/contracts';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { priceDecimals } from '@/core/format/number';
import { splitPair } from '@/core/format/pair';
import { useOrderBook } from '@/features/market-stream';
import { AppText } from '@/shared/ui';
import { BOOK_ROW_HEIGHT, OrderBookRow } from './OrderBookRow';

export const BOOK_DEPTH_ROWS = 10;

/** Live bids (best first) and asks (best first), as two tables like the mockup. */
export function OrderBook({ pair }: { pair: string }) {
  const book = useOrderBook(pair);
  const { base, quote } = splitPair(pair);
  const decimals = useMemo(() => tickDecimals(book?.bids ?? []), [book?.bids]);

  if (!book) {
    return (
      <View style={styles.placeholder}>
        <AppText color="textMuted">Waiting for order book…</AppText>
      </View>
    );
  }

  return (
    <View>
      <Side side="bid" levels={book.bids} base={base} quote={quote} decimals={decimals} />
      <Side side="ask" levels={book.asks} base={base} quote={quote} decimals={decimals} />
    </View>
  );
}

const Side = memo(function Side({
  side,
  levels,
  base,
  quote,
  decimals,
}: {
  side: 'bid' | 'ask';
  levels: readonly BookLevel[];
  base: string;
  quote: string;
  decimals: number;
}) {
  const visible = levels.slice(0, BOOK_DEPTH_ROWS);
  let maxNotional = 0;
  for (const [p, q] of visible) maxNotional = Math.max(maxNotional, p * q);

  return (
    <View style={styles.side} accessibilityLabel={side === 'bid' ? 'Bids' : 'Asks'}>
      <View style={styles.header}>
        <AppText variant="label" color="textSecondary" style={styles.hPrice}>
          PRICE ({quote})
        </AppText>
        <AppText variant="label" color="textSecondary" style={styles.hQty}>
          AMOUNT ({base})
        </AppText>
        <AppText variant="label" color="textSecondary" style={styles.hTotal}>
          TOTAL
        </AppText>
      </View>
      {visible.map(([price, qty], i) => (
        // Keyed by depth index: rows are stable slots whose values (and bar widths) animate.
        <OrderBookRow
          key={i}
          side={side}
          price={price}
          quantity={qty}
          ratio={maxNotional > 0 ? (price * qty) / maxNotional : 0}
          priceDecimals={decimals}
        />
      ))}
      {Array.from({ length: Math.max(0, BOOK_DEPTH_ROWS - visible.length) }, (_, i) => (
        <View key={`empty-${i}`} style={{ height: BOOK_ROW_HEIGHT }} />
      ))}
    </View>
  );
});

/** Decimals needed to show every visible price (derived from the book's tick size). */
function tickDecimals(levels: readonly BookLevel[]): number {
  let decimals = 0;
  for (const [price] of levels.slice(0, BOOK_DEPTH_ROWS)) {
    const s = String(price);
    const dot = s.indexOf('.');
    if (dot >= 0) decimals = Math.max(decimals, s.length - dot - 1);
  }
  // Large prices always show cents even when the visible levels are whole numbers.
  const minimum = levels[0] && levels[0][0] >= 1 ? Math.min(2, priceDecimals(levels[0][0])) : 0;
  return Math.min(8, Math.max(decimals, minimum));
}

const styles = StyleSheet.create({
  side: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
  },
  hPrice: { flex: 1.1 },
  hQty: { flex: 1, textAlign: 'center' },
  hTotal: { flex: 1.1, textAlign: 'right' },
  placeholder: { height: 200, alignItems: 'center', justifyContent: 'center' },
});
