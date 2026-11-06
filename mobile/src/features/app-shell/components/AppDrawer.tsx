import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/core/theme';
import { AppText } from '@/shared/ui';
import { useDrawer } from '../store/drawer.store';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Account drawer from the mockup. The assignment has no authentication, so the
 * profile and items are presentational placeholders.
 */
export function AppDrawer() {
  const visible = useDrawer((s) => s.visible);
  const close = useDrawer((s) => s.close);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View
        entering={SlideInLeft.duration(220)}
        exiting={SlideOutLeft.duration(180)}
        style={[styles.panel, { width: Math.min(320, width * 0.82), paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-circle-outline" size={30} color={colors.textInverted} />
          </View>
          <View>
            <AppText variant="heading">Pro Trader</AppText>
            <AppText variant="bodySmall" color="textMuted">
              Demo account • <AppText variant="bodySmall" color="up">read-only</AppText>
            </AppText>
          </View>
        </View>

        <Section title="ACCOUNT">
          <Item icon="key-outline" label="API Keys" />
          <Item icon="shield-half-full" label="Security" />
        </Section>
        <Section title="TRADING">
          <Item icon="history" label="Trade History" active />
          <Item icon="help-circle-outline" label="Support" />
        </Section>

        <View style={styles.footer}>
          <AppText variant="bodySmall" color="textMuted">
            Account features are out of scope for this demo.
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" color="textMuted" style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Item({ icon, label, active }: { icon: IconName; label: string; active?: boolean }) {
  return (
    <View style={[styles.item, active && styles.itemActive]} accessibilityRole="menuitem" accessibilityState={{ disabled: true }}>
      <MaterialCommunityIcons name={icon} size={20} color={active ? colors.textInverted : colors.textSecondary} />
      <AppText variant="subheading" style={{ color: active ? colors.textInverted : colors.textSecondary }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.overlay },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    borderRightColor: colors.borderSubtle,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.up,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: spacing.xl, gap: spacing.xs },
  sectionTitle: { marginBottom: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.up },
  footer: { marginTop: 'auto' },
});
