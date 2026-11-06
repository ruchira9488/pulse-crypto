/**
 * Design tokens from the PulseCrypto design system mockup.
 *
 *   Primary   #0B0E14  app background
 *   Secondary #00C57A  positive: price up, bids, "live"
 *   Tertiary  #FF3B69  negative: price down, asks, alerts
 *   Neutral   #1E2633  surfaces, borders, chrome
 */
export const palette = {
  primary: {
    950: '#000000',
    900: '#0B0E14',
    800: '#11151D',
    700: '#161B25',
  },
  secondary: {
    950: '#00170E',
    900: '#00301D',
    800: '#0B3B2A',
    700: '#00663F',
    600: '#008A55',
    500: '#00C57A',
    400: '#3DDC97',
    300: '#6CF5B5',
    200: '#B8FBD9',
  },
  tertiary: {
    950: '#2A0610',
    900: '#4A0A1D',
    800: '#4A1A28',
    700: '#A0002F',
    600: '#D41F4B',
    500: '#FF3B69',
    400: '#FF6B8B',
    300: '#FF8FA8',
    200: '#FFB3C1',
    100: '#FFE0E7',
  },
  neutral: {
    900: '#0E1219',
    800: '#171C26',
    700: '#1E2633',
    600: '#2A3342',
    500: '#3B4555',
    400: '#5B6577',
    300: '#8A93A5',
    200: '#B8BFCC',
    100: '#DDE3EE',
    50: '#EEF2FF',
  },
} as const;

/** Semantic aliases: components use these, never raw palette values. */
export const colors = {
  background: palette.primary[900],
  backgroundDeep: palette.primary[950],
  surface: palette.neutral[800],
  surfaceRaised: palette.neutral[700],
  surfaceSunken: palette.primary[800],
  border: palette.neutral[600],
  borderSubtle: palette.neutral[700],

  textPrimary: palette.neutral[100],
  textSecondary: palette.neutral[200],
  textMuted: palette.neutral[300],
  textDisabled: palette.neutral[400],
  textInverted: palette.primary[900],

  inverted: '#E1E6F5',
  buttonPrimary: '#C5C9D3',

  up: palette.secondary[500],
  upSoft: palette.secondary[400],
  upMuted: palette.secondary[800],
  upFlash: 'rgba(0, 197, 122, 0.28)',
  down: palette.tertiary[500],
  downSoft: palette.tertiary[300],
  downMuted: palette.tertiary[800],
  downFlash: 'rgba(255, 59, 105, 0.28)',

  bidDepth: 'rgba(0, 197, 122, 0.14)',
  askDepth: 'rgba(255, 59, 105, 0.14)',
  bidArea: '#0B4A33',
  askArea: '#5A1E30',

  warning: '#F5B544',
  overlay: 'rgba(0, 0, 0, 0.55)',
} as const;

export type ColorToken = keyof typeof colors;
