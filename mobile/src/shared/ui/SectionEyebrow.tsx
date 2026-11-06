import { AppText } from './AppText';
import type { ColorToken } from '@/core/theme';

/** Small mono uppercase label above a section title ("NETWORK CONTROL"). */
export function SectionEyebrow({ children, color = 'up' }: { children: string; color?: ColorToken }) {
  return (
    <AppText variant="label" color={color} uppercase>
      {children}
    </AppText>
  );
}
