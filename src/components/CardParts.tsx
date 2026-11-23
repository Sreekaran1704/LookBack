import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { type IconName } from './Buttons';
import { PressableScale } from './PressableScale';
import { HAND_TAIL } from './Screen';

/** The pieces a settings-style paper card is made of (Settings and You): its heading, help lines and rows. */

/** A page's heading: its icon in the card's paper color on a small solid ink disc, and the title in ink. */
export function CardTitle({ icon, title }: { icon: IconName; title: string; color?: string }) {
  const { colors, spacing, typography, sizes } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.sm }]}>
      <View style={[styles.badge, { backgroundColor: colors.ink, width: sizes.icon * 1.6, height: sizes.icon * 1.6, borderRadius: sizes.icon }]}>
        <Ionicons name={icon} size={sizes.iconSmall + 1} color={colors.panel} />
      </View>
      <Text style={[typography.heading, { color: colors.ink, flex: 1 }]}>
        {title}
        {HAND_TAIL}
      </Text>
    </View>
  );
}

export function Help({ children }: { children: ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return <Text style={[typography.caption, { color: colors.inkMuted, paddingVertical: spacing.sm }]}>{children}</Text>;
}

/** One line on a paper card: label on the left, control on the right. */
export function Row({ label, divider = false, children }: { label: string; divider?: boolean; children?: ReactNode }) {
  const { colors, spacing, typography, sizes } = useTheme();
  return (
    <View style={[styles.row, styles.between, { minHeight: sizes.rowHeight, gap: spacing.md }, divider ? { borderTopWidth: 1, borderTopColor: colors.ruleLine } : null]}>
      {/* flex: 1 — Android under-measures a shrink-wrapped label, so give it the row's width instead of its own. */}
      <Text style={[typography.print, { color: colors.ink, flex: 1 }]}>{label}</Text>
      {children}
    </View>
  );
}

export function ActionRow({ label, divider = false, onPress }: { label: string; divider?: boolean; onPress: () => void }) {
  const { colors, sizes } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Row label={label} divider={divider}>
        <Ionicons name="arrow-forward" size={sizes.iconSmall} color={colors.ink} />
      </Row>
    </PressableScale>
  );
}

/** A handwritten tick, matching the paper and the person's words. */
export function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  const { colors, spacing, typography, sizes } = useTheme();
  const size = sizes.checkbox;
  return (
    <PressableScale onPress={onPress} haptic={false} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}>
      <View style={[styles.row, { minHeight: sizes.rowHeight, gap: spacing.md }]}>
        <Svg width={size + 6} height={size + 6}>
          <Path d={`M 3 4 L ${size} 3 L ${size + 1} ${size} L 4 ${size + 1} Z`} stroke={colors.ink} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {checked ? <Path d={`M 6 ${size / 2 + 1} L ${size / 2 - 1} ${size - 3} L ${size + 4} 0`} stroke={colors.sepia} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        <Text style={[typography.print, { color: colors.ink, flex: 1 }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  badge: { alignItems: 'center', justifyContent: 'center' },
});
