import { Pressable, Text, View } from 'react-native';
import { tapHaptic } from '../lib/haptics';
import { control, useTheme, withAlpha, type Theme } from '../theme';
import { Stitches, WashIn } from './PaperTabs';
import { Texture } from './scrapbook/Texture';

/** Years the person colors are borrowed from (each person keeps one, picked by their id). */
const FIRST_YEAR = 2021;
const COLORS = 5;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}
/** A person's own color, the same on every phone and every visit (one of the year colors). */
export function personColor(theme: Theme, id: string): string {
  return theme.year(FIRST_YEAR + (hash(id) % COLORS)).primary;
}

/**
 * A person's seal: a round wax-colored disc in their own color with their initial pressed into it, the way a letter is
 * sealed. Shown beside their name wherever they appear.
 */
export function PersonSeal({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const theme = useTheme();
  const color = personColor(theme, id);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: `0px 1px 2px ${withAlpha('#000000', 0.25)}, inset 0px -2px 3px ${withAlpha('#000000', 0.18)}`,
      }}
    >
      <Texture kind="paper" opacity={0.25} radius={size / 2} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, borderRadius: size / 2, borderWidth: 1, borderColor: withAlpha('#FFFFFF', 0.35) }} />
      <Text style={[theme.typography.heading, { color: '#FFFFFF', fontSize: size * 0.48, lineHeight: size * 0.6, paddingRight: 0, textAlign: 'center' }]}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * A person as a button (give to them, add them): their seal and the words, on the same stitched paper as every button,
 * washed when it's the page's main action.
 */
export function PersonButton({ id, name, label, onPress, disabled, main = true }: { id: string; name: string; label: string; onPress: () => void; disabled?: boolean; main?: boolean }) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: control.height + 8,
        borderRadius: control.radius,
        backgroundColor: colors.panel,
        boxShadow: theme.shadow(undefined, 1),
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Texture kind="paper" opacity={0.5} radius={control.radius} />
      <Stitches />
      {main ? <WashIn color={colors.gilt} /> : null}
      <PersonSeal id={id} name={name} size={36} />
      <Text numberOfLines={1} style={[typography.print, { color: colors.ink, flex: 1, fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  );
}
