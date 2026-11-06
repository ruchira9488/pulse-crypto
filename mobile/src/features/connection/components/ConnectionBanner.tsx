import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { colors, spacing } from '@/core/theme';
import { marketStream, useConnectionStore } from '@/features/market-stream';
import { formatClock } from '@/core/format/number';
import { AppText, Button } from '@/shared/ui';
import { toneColors } from '../model/connection-view';
import { useConnectionView } from './use-connection-view';

/** Explains degraded states and offers a manual retry. Hidden while live. */
export function ConnectionBanner() {
  const view = useConnectionView();
  const lastLiveAt = useConnectionStore((s) => s.lastLiveAt);
  const status = useConnectionStore((s) => s.status);
  if (!view.detail || view.tone === 'idle') return null;

  const tone = toneColors[view.tone];
  const canRetry = status === 'reconnecting';
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={[styles.banner, { borderLeftColor: tone.fg }]}>
      <View style={styles.text}>
        <AppText variant="label" style={{ color: tone.fg }}>
          {view.label}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary">
          {view.detail}
          {lastLiveAt && view.tone === 'down' ? ` Last update ${formatClock(lastLiveAt).slice(0, 8)}.` : ''}
        </AppText>
      </View>
      {canRetry && <Button label="RETRY" variant="outlined" compact onPress={() => marketStream.reconnectNow()} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surfaceSunken,
    borderLeftWidth: 3,
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
});
