import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, spacing } from '@/core/theme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChangeText, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search trading pairs"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={12} accessibilityLabel="Clear search">
          <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 15,
    paddingVertical: 0,
  },
});
