export { colors, palette, type ColorToken } from './colors';
export { fonts, typography, type TypographyVariant } from './typography';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** The design language is mostly square; cards get a soft radius. */
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,
} as const;
