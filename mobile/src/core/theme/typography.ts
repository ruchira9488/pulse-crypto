import type { TextStyle } from 'react-native';

/**
 * Three families, as in the design system:
 *   Headline: Hanken Grotesk   (screen titles, big numbers)
 *   Body:     Inter            (copy)
 *   Label:    JetBrains Mono   (labels and every number; tabular digits stop
 *                              prices "jittering" sideways as they update)
 */
export const fonts = {
  headline: 'HankenGrotesk_600SemiBold',
  headlineBold: 'HankenGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.headlineBold, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: fonts.headline, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.headline, fontSize: 19, lineHeight: 25 },
  subheading: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
  monoMedium: { fontFamily: fonts.monoMedium, fontSize: 14, lineHeight: 19 },
  monoLarge: { fontFamily: fonts.monoBold, fontSize: 32, lineHeight: 38 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
