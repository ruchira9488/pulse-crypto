import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, palette, spacing } from '@/core/theme';
import { env } from '@/core/config/env';
import { formatBytes } from '@/core/format/number';
import { measureStorageBytes } from '@/core/storage/persist';
import { useConnectionStore } from '@/features/market-stream';
import { AppText, Card, IconTile } from '@/shared/ui';

type IconName = ComponentProps<typeof IconTile>['name'];

/**
 * Info cards from the mockup, filled with real values for this app rather than
 * the mockup's web-only examples (WebGL, IndexedDB).
 */
export function SystemInfoCards() {
  const latency = useConnectionStore((s) => s.latencyMs);
  const [storageBytes, setStorageBytes] = useState<number>();

  useEffect(() => {
    void measureStorageBytes().then(setStorageBytes);
  }, []);

  const host = env.wsUrl.replace(/^wss?:\/\//, '').replace(/\/ws$/, '');

  return (
    <View style={styles.list}>
      <InfoCard
        icon="lightning-bolt"
        iconColor={colors.up}
        iconBg={colors.upMuted}
        title="GPU ACCELERATION"
        titleColor={colors.up}
        body="Skia render pipeline: depth chart & gauges on the UI thread"
      />
      <InfoCard
        icon="shield-half-full"
        iconColor={palette.tertiary[300]}
        iconBg={colors.downMuted}
        title="API LATENCY"
        titleColor={palette.tertiary[300]}
        body={`Ping: ${latency !== undefined ? `${latency}ms` : '—'} (${host})`}
      />
      <InfoCard
        icon="database-outline"
        iconColor={colors.textSecondary}
        iconBg={colors.surfaceRaised}
        title="STORAGE CACHE"
        titleColor={colors.textSecondary}
        body={`AsyncStorage: ${storageBytes !== undefined ? formatBytes(storageBytes) : '…'} utilized`}
      />
    </View>
  );
}

function InfoCard(props: { icon: IconName; iconColor: string; iconBg: string; title: string; titleColor: string; body: string }) {
  return (
    <Card style={styles.card}>
      <IconTile name={props.icon} color={props.iconColor} background={props.iconBg} size={48} />
      <View style={{ flex: 1 }}>
        <AppText variant="label" style={{ color: props.titleColor }}>
          {props.title}
        </AppText>
        <AppText color="textSecondary">{props.body}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
