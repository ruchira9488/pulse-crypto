import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, typography, type TypographyVariant } from '@/core/theme';
import { formatPercent } from '@/core/format/number';
import { AppText } from './AppText';

/**
 * "▲ 1.82%" / "▼ 0.41%" coloured by sign. The arrow is an icon rather than a
 * glyph: JetBrains Mono has no ▲/▼, and Android's font fallback mis-measures
 * the mixed run, clipping the number.
 */
export const ChangeLabel = memo(function ChangeLabel({ value, variant = 'mono' }: { value?: number; variant?: TypographyVariant }) {
  if (value === undefined) {
    return (
      <AppText variant={variant} color="textMuted">
        —
      </AppText>
    );
  }
  const up = value >= 0;
  const color = up ? colors.up : colors.down;
  const size = (typography[variant].fontSize ?? 14) + 6;
  return (
    <View style={styles.row} accessibilityLabel={`${up ? 'up' : 'down'} ${formatPercent(Math.abs(value))}`}>
      <MaterialCommunityIcons name={up ? 'menu-up' : 'menu-down'} size={size} color={color} style={styles.icon} />
      <AppText variant={variant} style={{ color }}>
        {formatPercent(Math.abs(value))}
      </AppText>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginHorizontal: -4 },
});
