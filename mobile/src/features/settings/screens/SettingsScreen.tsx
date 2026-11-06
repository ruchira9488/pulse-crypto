import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { formatPair } from '@/core/format/pair';
import { useDrawer } from '@/features/app-shell';
import { ConnectionBadge } from '@/features/connection';
import { useSelectedPair } from '@/features/market-details';
import { PerformanceDashboard } from '@/features/telemetry';
import { AppHeader, AppText } from '@/shared/ui';
import { SystemInfoCards } from '../components/SystemInfoCards';
import { ThrottleConfigurator } from '../components/ThrottleConfigurator';

export function SettingsScreen() {
  const openDrawer = useDrawer((s) => s.open);
  const pair = useSelectedPair();
  return (
    <View style={styles.screen}>
      <AppHeader title={formatPair(pair)} onMenuPress={openDrawer} right={<ConnectionBadge />} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="title">System Settings & Telemetry</AppText>
          <AppText color="textSecondary">Real-time performance monitoring and data ingestion controls.</AppText>
        </View>
        <ThrottleConfigurator />
        <PerformanceDashboard />
        <SystemInfoCards />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  intro: { gap: spacing.sm },
});
