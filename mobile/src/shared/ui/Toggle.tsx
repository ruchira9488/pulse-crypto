import { Switch } from 'react-native';
import { colors, palette } from '@/core/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.surfaceRaised, true: palette.secondary[400] }}
      thumbColor={value ? palette.neutral[50] : palette.neutral[50]}
      ios_backgroundColor={colors.surfaceRaised}
    />
  );
}
