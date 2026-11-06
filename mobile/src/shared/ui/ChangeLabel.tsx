import { memo } from 'react';
import { colors } from '@/core/theme';
import { formatPercent } from '@/core/format/number';
import { AppText } from './AppText';
import type { TypographyVariant } from '@/core/theme';

/** "▲ 1.82%" / "▼ 0.41%" coloured by sign. */
export const ChangeLabel = memo(function ChangeLabel({ value, variant = 'mono' }: { value?: number; variant?: TypographyVariant }) {
  if (value === undefined) return <AppText variant={variant} color="textMuted">—</AppText>;
  const up = value >= 0;
  return (
    <AppText variant={variant} style={{ color: up ? colors.up : colors.down }}>
      {up ? '▲' : '▼'} {formatPercent(Math.abs(value))}
    </AppText>
  );
});
