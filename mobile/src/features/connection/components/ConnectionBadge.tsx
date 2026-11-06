import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { radius, spacing } from '@/core/theme';
import { AppText } from '@/shared/ui';
import { toneColors } from '../model/connection-view';
import { StatusDot } from './StatusDot';
import { useConnectionView } from './use-connection-view';

/**
 * `pill`: the "((•)) LIVE" chip in the header.
 * `inline`: "• CONNECTED" text next to a title (Terminal mockup).
 */
export function ConnectionBadge({ variant = 'pill' }: { variant?: 'pill' | 'inline' }) {
  const view = useConnectionView();
  const tone = toneColors[view.tone];

  if (variant === 'inline') {
    const label = view.tone === 'live' ? 'CONNECTED' : view.label;
    return (
      <View style={styles.inline} accessibilityLabel={`Connection ${label.toLowerCase()}`}>
        <StatusDot color={tone.fg} pulsing={view.tone !== 'live' && view.tone !== 'idle'} size={7} />
        <AppText variant="label" style={{ color: tone.fg }}>
          {label}
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]} accessibilityLabel={`Connection ${view.label.toLowerCase()}`}>
      {view.tone === 'live' ? (
        <MaterialCommunityIcons name="access-point" size={14} color={tone.fg} />
      ) : (
        <StatusDot color={tone.fg} pulsing size={7} />
      )}
      <AppText variant="label" style={{ color: tone.fg }}>
        {view.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
});
