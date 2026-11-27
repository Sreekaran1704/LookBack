import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { control, useTheme } from '../theme';
import { Stitches, WashIn } from './PaperTabs';
import { Texture } from './scrapbook/Texture';
import { PressableScale } from './PressableScale';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface CircleButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Shadow tint (a year color). */
  tint?: string;
}

/** A round paper disc with a soft tinted shadow (back, add, settings…). Stays paper-light in dark mode. */
export function CircleButton({ icon, onPress, accessibilityLabel, tint }: CircleButtonProps) {
  const theme = useTheme();
  const { colors, sizes } = theme;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={sizes.hitSlop}
      style={[
        styles.circle,
        {
          width: sizes.circleButton,
          height: sizes.circleButton,
          borderRadius: sizes.circleButton / 2,
          backgroundColor: colors.control,
          boxShadow: theme.shadow(tint, 0.8),
        },
      ]}
    >
      <Ionicons name={icon} size={sizes.icon} color={colors.ink} />
    </PressableScale>
  );
}

export type PillTone = 'paper' | 'dark' | 'amber' | 'green';

interface PillButtonProps {
  label: string;
  icon?: IconName;
  tone?: PillTone;
  /** Tall, full-width call to action. */
  large?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** A sticker pill: this color with white text and a white die-cut edge (overrides `tone`). */
  color?: string;
  /** Share a row equally with the buttons next to it. */
  grow?: boolean;
  /** With `color`: a quiet sticker, white with a colored edge and colored text (for cautious actions). */
  outline?: boolean;
}

/**
 * Pill: paper by default, `dark` (ink) for the main action, amber for reminder status, green for saved.
 * Without onPress it's a static badge.
 */
export function PillButton({ label, icon, tone = 'paper', large = false, onPress, disabled, accessibilityLabel, color, grow = false, outline = false }: PillButtonProps) {
  const theme = useTheme();
  const { colors, sizes, spacing, typography } = theme;
  // The same stitched cream paper as the bar and every other control; what matters is marked with a highlighter wash.
  const wash = color ? (outline ? null : color) : { paper: null, dark: colors.gilt, amber: colors.amber, green: colors.green }[tone];
  const ink = color && outline ? color : colors.ink;
  const content = (
    <>
      <Texture kind="paper" opacity={0.5} radius={control.radius} />
      <Stitches />
      {wash ? <WashIn color={wash} /> : null}
      {icon ? <Ionicons name={icon} size={large ? sizes.icon - 2 : sizes.iconSmall + 1} color={ink} /> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[typography.small, { color: ink, fontSize: large ? 16 : 15, lineHeight: large ? 20 : 19, fontWeight: '700', flexShrink: 1, paddingRight: 0 }]}>
        {label}
      </Text>
    </>
  );
  const style = [
    styles.pill,
    {
      minHeight: control.height,
      paddingHorizontal: spacing.gutter,
      gap: spacing.sm,
      borderRadius: control.radius,
      backgroundColor: colors.panel,
      boxShadow: theme.shadow(undefined, 0.8),
    },
    grow ? styles.grow : large ? styles.stretch : styles.hug,
  ];

  if (!onPress) {
    return (
      <View style={style} accessibilityLabel={accessibilityLabel ?? label}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={style}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  hug: { alignSelf: 'flex-start' },
  stretch: { alignSelf: 'stretch' },
  grow: { flex: 1, paddingHorizontal: 12 },
});
