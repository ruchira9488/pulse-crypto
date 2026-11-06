import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { INTERVAL_LIMITS } from '@pulse/contracts';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, palette, spacing } from '@/core/theme';
import { useConnectionStore } from '@/features/market-stream';
import { AppText, Card, SectionEyebrow, Toggle } from '@/shared/ui';
import { useSettingsStore } from '../store/settings.store';

/**
 * "Network Control / Data Throttling Configurator".
 * These controls are real: they change how often the gateway sends this
 * device frames (per-client interval), whether frames are deflate-compressed,
 * and whether the server may back off automatically when the client lags.
 */
export function ThrottleConfigurator() {
  const intervalMs = useSettingsStore((s) => s.intervalMs);
  const adaptive = useSettingsStore((s) => s.adaptive);
  const compress = useSettingsStore((s) => s.compress);
  const { setIntervalMs, setAdaptive, setCompress } = useSettingsStore.getState();
  const compressionAvailable = useConnectionStore((s) => s.compressionAvailable);
  const effective = useConnectionStore((s) => s.effectiveIntervalMs);

  // Local value while dragging; commit (one network message) on release.
  const [draft, setDraft] = useState(intervalMs);
  useEffect(() => setDraft(intervalMs), [intervalMs]);

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <SectionEyebrow>NETWORK CONTROL</SectionEyebrow>
          <AppText variant="heading">Data Throttling Configurator</AppText>
        </View>
        <MaterialCommunityIcons name="speedometer" size={22} color={colors.textSecondary} />
      </View>

      <View style={styles.freqRow}>
        <AppText color="textSecondary">Update Frequency</AppText>
        <AppText variant="monoMedium" style={{ color: colors.up, fontSize: 18 }}>
          {Math.round(draft)}ms
        </AppText>
      </View>
      <Slider
        minimumValue={INTERVAL_LIMITS.min}
        maximumValue={INTERVAL_LIMITS.max}
        step={10}
        value={draft}
        onValueChange={setDraft}
        onSlidingComplete={setIntervalMs}
        minimumTrackTintColor={palette.secondary[400]}
        maximumTrackTintColor={colors.border}
        thumbTintColor={palette.secondary[400]}
        accessibilityLabel="Update frequency in milliseconds"
        style={styles.slider}
      />
      <View style={styles.scale}>
        {['10ms', '500ms', '1000ms'].map((l) => (
          <AppText key={l} variant="label" color="textMuted">
            {l}
          </AppText>
        ))}
      </View>
      {adaptive && effective !== undefined && effective !== intervalMs && (
        <AppText variant="bodySmall" style={{ color: palette.secondary[300] }}>
          Adaptive: server currently sending every {effective}ms
        </AppText>
      )}

      <View style={styles.divider} />

      <ToggleRow
        label="Binary Protocol Compression"
        hint={compressionAvailable ? 'permessage-deflate on each frame' : 'Not negotiated on this connection'}
        value={compress}
        onChange={setCompress}
        disabled={!compressionAvailable}
      />
      <ToggleRow
        label="Adaptive Polling Strategy"
        hint="Server widens the interval while this device falls behind"
        value={adaptive}
        onChange={setAdaptive}
      />
    </Card>
  );
}

function ToggleRow(props: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <AppText>{props.label}</AppText>
        <AppText variant="bodySmall" color="textMuted">
          {props.hint}
        </AppText>
      </View>
      <Toggle value={props.value} onValueChange={props.onChange} accessibilityLabel={props.label} disabled={props.disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  freqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slider: { marginHorizontal: -spacing.xs, height: 36 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
});
