import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { colors } from '@/core/theme';
import { useFavouritesStore, useIsFavourite } from '../store/favourites.store';

export const FavouriteToggle = memo(function FavouriteToggle({ symbol, size = 22 }: { symbol: string; size?: number }) {
  const isFavourite = useIsFavourite(symbol);
  const toggle = useFavouritesStore((s) => s.toggle);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = useCallback(() => {
    scale.value = withSequence(withSpring(1.3, { duration: 120 }), withSpring(1, { duration: 200 }));
    void Haptics.selectionAsync().catch(() => {});
    toggle(symbol);
  }, [scale, symbol, toggle]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: isFavourite }}
      accessibilityLabel={isFavourite ? `Remove ${symbol} from favourites` : `Add ${symbol} to favourites`}
    >
      <Animated.View style={style}>
        <MaterialCommunityIcons
          name={isFavourite ? 'star' : 'star-outline'}
          size={size}
          color={isFavourite ? colors.warning : colors.textMuted}
        />
      </Animated.View>
    </Pressable>
  );
});
