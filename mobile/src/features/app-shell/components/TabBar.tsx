import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '@/core/theme';
import { AppText } from '@/shared/ui';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Terminal', icon: 'chart-timeline-variant-shimmer' },
  markets: { label: 'Markets', icon: 'chart-line' },
  telemetry: { label: 'Telemetry', icon: 'chart-box-outline' },
  settings: { label: 'Settings', icon: 'cog-outline' },
};

/** Bottom bar from the mockup: active tab sits in a tinted pill. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          if (!focused) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={[styles.tab, focused && styles.tabActive]}
          >
            <MaterialCommunityIcons name={tab.icon} size={22} color={focused ? colors.up : colors.textSecondary} />
            <AppText
              variant="bodySmall"
              style={[styles.label, { color: focused ? colors.up : colors.textSecondary }]}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopColor: colors.borderSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs + 2, borderRadius: radius.lg, gap: 2 },
  tabActive: { backgroundColor: colors.upMuted },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
});
