import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { colors, palette, spacing } from '@/core/theme';
import { selectIsLive, useConnectionStore } from '@/features/market-stream';
import { AppText, Button, Card, SectionEyebrow } from '@/shared/ui';
import { useTelemetryStore } from '../store/telemetry.store';
import { FpsRing } from './FpsRing';
import { Sparkline } from './Sparkline';

/** "System Telemetry / Performance Dashboard" card from the Settings mockup. */
export function PerformanceDashboard() {
  const { jsFps, messagesPerSec, memory, memoryHistory, reset } = useTelemetryStore(
    useShallow((s) => ({ jsFps: s.jsFps, messagesPerSec: s.messagesPerSec, memory: s.memory, memoryHistory: s.memoryHistory, reset: s.reset })),
  );
  const live = useConnectionStore(selectIsLive);
  const healthy = live && jsFps >= 45;

  return (
    <Card style={styles.card}>
      <SectionEyebrow color="downSoft">SYSTEM TELEMETRY</SectionEyebrow>
      <View style={styles.titleRow}>
        <AppText variant="heading" style={styles.title}>
          Performance Dashboard
        </AppText>
        <View style={styles.actions}>
          <Button label="RESET" variant="secondary" compact onPress={reset} />
          <View style={[styles.health, { borderColor: healthy ? colors.up : colors.warning }]}>
            <AppText variant="label" style={{ color: healthy ? colors.up : colors.warning }}>
              {healthy ? 'HEALTHY' : live ? 'DEGRADED' : 'NO FEED'}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.tile}>
        <FpsRing fps={jsFps} />
        <AppText color="textSecondary">JS Thread Frame Rate</AppText>
      </View>

      <View style={styles.tile}>
        <MaterialCommunityIcons name="layers-triple-outline" size={28} color={palette.tertiary[300]} />
        <AppText variant="monoLarge">{messagesPerSec}</AppText>
        <AppText variant="label" color="textSecondary">
          msgs/sec
        </AppText>
        <AppText color="textSecondary">WS Message Ingestion Rate</AppText>
      </View>

      <View style={[styles.tile, styles.memoryTile]}>
        <View style={styles.memoryHeader}>
          <AppText color="textSecondary">Memory Footprint Tracker</AppText>
          <AppText variant="monoMedium" style={{ color: palette.tertiary[300] }}>
            {memory ? `${memory.totalMb.toFixed(1)} MB` : 'n/a'}
          </AppText>
        </View>
        {memory && (
          <AppText variant="bodySmall" color="textMuted">
            {`Live heap ${memory.liveMb.toFixed(1)} · External ${memory.externalMb.toFixed(1)} · Reserved ${memory.reservedMb.toFixed(1)} MB`}
          </AppText>
        )}
        <Sparkline values={memoryHistory} color={palette.tertiary[300]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  health: { borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: 'rgba(0,197,122,0.08)' },
  tile: { backgroundColor: colors.surfaceSunken, alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  memoryTile: { alignItems: 'stretch', paddingHorizontal: spacing.lg, paddingBottom: 0 },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
});
