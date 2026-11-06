import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'inverted' | 'outlined';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Square-cornered buttons from the design system (Primary / Secondary / Inverted / Outlined). */
export function Button({ label, onPress, variant = 'primary', compact, disabled, style, accessibilityLabel }: ButtonProps) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.75 },
        style,
      ]}
    >
      <AppText variant={compact ? 'label' : 'monoMedium'} style={{ color: v.fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const variants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.buttonPrimary, fg: colors.textInverted, border: colors.buttonPrimary },
  secondary: { bg: colors.surfaceRaised, fg: colors.textPrimary, border: colors.surfaceRaised },
  inverted: { bg: colors.inverted, fg: colors.textInverted, border: colors.inverted },
  outlined: { bg: 'transparent', fg: colors.textPrimary, border: colors.textMuted },
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
