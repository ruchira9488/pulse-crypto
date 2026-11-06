import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius } from '@/core/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Square icon chip (design system "icon button" tiles). */
export function IconTile({ name, color, background, size = 44 }: { name: IconName; color: string; background: string; size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: background }]}>
      <MaterialCommunityIcons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
});
