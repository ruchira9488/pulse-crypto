import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme';
import { AppText } from '@/shared/ui';

interface FilterChipsProps {
  favouritesOnly: boolean;
  favouriteCount: number;
  onChange: (favouritesOnly: boolean) => void;
}

export function FilterChips({ favouritesOnly, favouriteCount, onChange }: FilterChipsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      <Chip label="ALL" active={!favouritesOnly} onPress={() => onChange(false)} />
      <Chip label={`★ FAVOURITES (${favouriteCount})`} active={favouritesOnly} onPress={() => onChange(true)} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.active : styles.inactive]}
    >
      <AppText variant="label" style={{ color: active ? colors.textInverted : colors.textSecondary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderWidth: 1 },
  active: { backgroundColor: colors.inverted, borderColor: colors.inverted },
  inactive: { backgroundColor: 'transparent', borderColor: colors.border },
});
