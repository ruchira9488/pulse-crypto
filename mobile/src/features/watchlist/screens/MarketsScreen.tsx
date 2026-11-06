import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { ConnectionBadge, ConnectionBanner } from '@/features/connection';
import { useSelectedPairStore } from '@/features/market-details';
import { usePairsMetaStore } from '@/features/pairs-meta';
import { useDrawer } from '@/features/app-shell';
import { AppHeader, AppText, SearchInput } from '@/shared/ui';
import { FilterChips } from '../components/FilterChips';
import { WatchlistRow } from '../components/WatchlistRow';
import { useWatchlist } from '../model/use-watchlist';

export function MarketsScreen() {
  const router = useRouter();
  const openDrawer = useDrawer((s) => s.open);
  const [query, setQuery] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const filter = useMemo(() => ({ query, favouritesOnly }), [query, favouritesOnly]);
  const { symbols, favouriteCount } = useWatchlist(filter);

  const refreshing = usePairsMetaStore((s) => s.loading);
  const refresh = usePairsMetaStore((s) => s.refresh);
  const metaError = usePairsMetaStore((s) => s.error);
  const metaSource = usePairsMetaStore((s) => s.source);
  const select = useSelectedPairStore((s) => s.select);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openPair = useCallback(
    (symbol: string) => {
      select(symbol);
      router.navigate('/');
    },
    [router, select],
  );

  const renderItem = useCallback(({ item }: { item: string }) => <WatchlistRow symbol={item} onPress={openPair} />, [openPair]);

  return (
    <View style={styles.screen}>
      <AppHeader title="Markets" onMenuPress={openDrawer} right={<ConnectionBadge />} />
      <ConnectionBanner />
      <View style={styles.controls}>
        <SearchInput value={query} onChangeText={setQuery} />
        <FilterChips favouritesOnly={favouritesOnly} favouriteCount={favouriteCount} onChange={setFavouritesOnly} />
        {(metaError || metaSource === 'mock') && (
          <AppText variant="bodySmall" color="textMuted">
            {metaError ? `Metadata refresh failed: ${metaError}. Pull to retry.` : '24h metadata is mocked (exchange REST unavailable).'}
          </AppText>
        )}
      </View>
      <FlashList
        data={symbols}
        keyExtractor={(s) => s}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.up} colors={[colors.up]} progressBackgroundColor={colors.surface} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText color="textMuted">
              {favouritesOnly && !query ? 'No favourites yet. Tap ☆ to add one.' : query ? `No pairs match "${query}".` : 'Waiting for market data…'}
            </AppText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { padding: spacing.lg, gap: spacing.md },
  empty: { padding: spacing.xl, alignItems: 'center' },
});
