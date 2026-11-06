import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius, spacing } from '@/core/theme';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
