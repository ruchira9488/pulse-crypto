import { memo } from 'react';
import { Text, type TextProps } from 'react-native';
import { colors, typography, type ColorToken, type TypographyVariant } from '@/core/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  uppercase?: boolean;
}

/** The only Text component screens use, so typography stays on-token. */
export const AppText = memo(function AppText({
  variant = 'body',
  color = 'textPrimary',
  uppercase,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      allowFontScaling={false}
      {...rest}
      style={[typography[variant], { color: colors[color] }, uppercase && { textTransform: 'uppercase' }, style]}
    />
  );
});
