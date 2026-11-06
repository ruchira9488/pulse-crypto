import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '@/core/theme';
import { formatPair } from '@/core/format/pair';
import { FocusGate, useDrawer } from '@/features/app-shell';
import { ConnectionBadge, ConnectionBanner, useConnectionView } from '@/features/connection';
import { MarketDepthPanel } from '@/features/market-depth';
import { AppHeader } from '@/shared/ui';
import { MarketStats } from '../components/MarketStats';
import { OrderBook } from '../components/OrderBook';
import { PriceHeader } from '../components/PriceHeader';
import { useSelectedPair } from '../store/selected-pair.store';

/** "Terminal": market details for the selected pair. */
export function TerminalScreen() {
  const pair = useSelectedPair();
  const openDrawer = useDrawer((s) => s.open);
  return (
    <View style={styles.screen}>
      <AppHeader
        title={formatPair(pair)}
        onMenuPress={openDrawer}
        titleAccessory={<ConnectionBadge variant="inline" />}
        right={<LiveIcon />}
      />
      <ConnectionBanner />
      <FocusGate>
        <ScrollView contentContainerStyle={styles.content}>
          <PriceHeader pair={pair} />
          <MarketStats pair={pair} />
          <OrderBook pair={pair} />
          <MarketDepthPanel pair={pair} />
        </ScrollView>
      </FocusGate>
    </View>
  );
}

function LiveIcon() {
  const { tone } = useConnectionView();
  return (
    <MaterialCommunityIcons
      name={tone === 'live' ? 'access-point' : 'access-point-off'}
      size={20}
      color={tone === 'live' ? colors.up : colors.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 24 },
});
