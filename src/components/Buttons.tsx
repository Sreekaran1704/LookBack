import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
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
  const { colors, sizes, spacing, radii, typography } = theme;
  const palette = color
    ? outline
      ? { bg: colors.paperWhite, fg: color }
      : { bg: color, fg: colors.paperWhite }
    : {
        paper: { bg: colors.control, fg: colors.ink },
        dark: { bg: colors.primary, fg: colors.onPrimary },
        amber: { bg: colors.amber, fg: colors.onAmber },
        green: { bg: colors.green, fg: colors.onGreen },
      }[tone];

  const content = (
    <>
      {icon ? <Ionicons name={icon} size={large ? sizes.icon : sizes.iconSmall + 2} color={palette.fg} /> : null}
      {/* textBreakStrategy simple: Android's default strategy drops the last word of a shrink-wrapped Caveat label. */}
      <Text numberOfLines={1} textBreakStrategy="simple" style={[typography.label, { color: palette.fg, flexShrink: 0 }]}>
        {label}
      </Text>
    </>
  );
  const style = [
    styles.pill,
    {
      minHeight: large ? sizes.pillHeightLarge : sizes.pillHeight,
      paddingHorizontal: spacing.gutter,
      gap: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: palette.bg,
      boxShadow: theme.shadow(color ?? (tone === 'paper' || tone === 'dark' ? undefined : palette.bg), 0.8),
    },
    color ? { borderWidth: outline ? 2 : 3, borderColor: outline ? color : colors.paperWhite, borderStyle: outline ? ('dashed' as const) : ('solid' as const) } : null,
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
