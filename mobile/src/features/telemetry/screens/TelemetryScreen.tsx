import { ScrollView, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { colors, palette, spacing } from '@/core/theme';
import { env } from '@/core/config/env';
import { useDrawer } from '@/features/app-shell';
import { ConnectionBadge, ConnectionBanner } from '@/features/connection';
import { useConnectionStore } from '@/features/market-stream';
import { AppHeader, AppText, Card, SectionEyebrow } from '@/shared/ui';
import { Sparkline } from '../components/Sparkline';
import { useTelemetryStore } from '../store/telemetry.store';

/** Stream diagnostics: what the socket, the gateway and the render loop are doing right now. */
export function TelemetryScreen() {
  const openDrawer = useDrawer((s) => s.open);
  const t = useTelemetryStore(
    useShallow((s) => ({
      jsFps: s.jsFps,
      messagesPerSec: s.messagesPerSec,
      kbPerSec: s.kbPerSec,
      ticksPerSec: s.ticksPerSec,
      commitsPerSec: s.commitsPerSec,
      messagesHistory: s.messagesHistory,
      reconnects: s.reconnects,
      silenceSec: s.silenceSec,
      memory: s.memory,
    })),
  );
  const c = useConnectionStore(
    useShallow((s) => ({
      status: s.status,
      upstream: s.upstream,
      latencyMs: s.latencyMs,
      effectiveIntervalMs: s.effectiveIntervalMs,
      serverConfig: s.serverConfig,
      compressionAvailable: s.compressionAvailable,
      attempt: s.attempt,
    })),
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Telemetry" onMenuPress={openDrawer} right={<ConnectionBadge />} />
      <ConnectionBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <SectionEyebrow>STREAM THROUGHPUT</SectionEyebrow>
          <View style={styles.grid}>
            <Metric label="MSGS / SEC" value={String(t.messagesPerSec)} />
            <Metric label="KB / SEC" value={t.kbPerSec.toFixed(1)} />
            <Metric label="TICKS / SEC" value={String(t.ticksPerSec)} />
            <Metric label="RENDERS / SEC" value={String(t.commitsPerSec)} hint="store commits (≤ 1 per frame)" />
          </View>
          <Sparkline values={t.messagesHistory} color={colors.up} height={70} />
        </Card>

        <Card style={styles.card}>
          <SectionEyebrow color="downSoft">CONNECTION</SectionEyebrow>
          <Row label="Gateway socket" value={c.status.toUpperCase()} />
          <Row label="Exchange feed (upstream)" value={c.upstream.toUpperCase()} />
          <Row label="Round-trip latency" value={c.latencyMs !== undefined ? `${c.latencyMs} ms` : '—'} />
          <Row label="Requested interval" value={c.serverConfig ? `${c.serverConfig.intervalMs} ms` : '—'} />
          <Row
            label="Effective interval"
            value={c.effectiveIntervalMs !== undefined ? `${c.effectiveIntervalMs} ms` : '—'}
            highlight={!!c.serverConfig && c.effectiveIntervalMs !== c.serverConfig.intervalMs}
          />
          <Row label="Compression" value={c.compressionAvailable ? (c.serverConfig?.compress ? 'permessage-deflate ON' : 'available, OFF') : 'not negotiated'} />
          <Row label="Reconnects (session)" value={String(t.reconnects)} />
          <Row label="Silence" value={`${t.silenceSec}s since last message`} />
          <Row label="Endpoint" value={env.wsUrl} />
        </Card>

        <Card style={styles.card}>
          <SectionEyebrow>RUNTIME</SectionEyebrow>
          <Row label="JS thread FPS" value={String(t.jsFps)} />
          <Row label="Memory footprint" value={t.memory ? `${t.memory.totalMb.toFixed(1)} MB` : 'n/a'} />
          <Row label="Live JS heap" value={t.memory ? `${t.memory.liveMb.toFixed(1)} MB` : 'n/a'} />
          <Row label="External (native, JS-owned)" value={t.memory ? `${t.memory.externalMb.toFixed(1)} MB` : 'n/a'} />
          <Row label="Reserved heap (Hermes GC)" value={t.memory ? `${t.memory.reservedMb.toFixed(1)} MB` : 'n/a'} />
          <Row label="GC cycles" value={t.memory?.gcCount !== undefined ? String(t.memory.gcCount) : 'n/a'} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="monoLarge" style={styles.metricValue}>
        {value}
      </AppText>
      {hint && (
        <AppText variant="bodySmall" color="textMuted">
          {hint}
        </AppText>
      )}
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText color="textSecondary">{label}</AppText>
      <AppText variant="mono" style={{ color: highlight ? palette.secondary[300] : colors.textPrimary, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  metric: { width: '50%', gap: 2 },
  metricValue: { fontSize: 26, lineHeight: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
