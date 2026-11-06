import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '@/core/theme';
import { AppText } from './AppText';

interface AppHeaderProps {
  title: string;
  onMenuPress?: () => void;
  /** Rendered next to the title (e.g. connection status). */
  titleAccessory?: ReactNode;
  right?: ReactNode;
}

export function AppHeader({ title, onMenuPress, titleAccessory, right }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable onPress={onMenuPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Open menu">
        <MaterialCommunityIcons name="menu" size={24} color={colors.up} />
      </Pressable>
      <AppText variant="heading" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {titleAccessory}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: fonts.headlineBold },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
