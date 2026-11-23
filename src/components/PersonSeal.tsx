import { Pressable, Text, View } from 'react-native';
import { tapHaptic } from '../lib/haptics';
import { portraitFor } from '../lib/portrait';
import { control, useTheme } from '../theme';
import { FilmPortrait } from './scrapbook/FilmPortrait';
import { Stitches, WashIn } from './PaperTabs';
import { Texture } from './scrapbook/Texture';

/** A person's portrait in the lists (its height; the film frame is 64:78). */
const LIST_PORTRAIT = 52;

/**
 * A person's picture wherever they appear: their portrait (the one they made, which came with their pages, or the one
 * their name gives them until then) in its film frame. `hole` is what shows through the sprocket holes: the card it
 * sits on.
 */
export function PersonSeal({ name, portrait, size = LIST_PORTRAIT, hole }: { id?: string; name: string; portrait?: string | null; size?: number; hole?: string }) {
  const { colors } = useTheme();
  return (
    <View accessible={false}>
      <FilmPortrait portrait={portraitFor(portrait, name)} size={size} hole={hole ?? colors.panel} />
    </View>
  );
}

/**
 * A person as a button (give to them, add them): their seal and the words, on the same stitched paper as every button,
 * washed when it's the page's main action.
 */
export function PersonButton({ id, name, portrait, label, onPress, disabled, main = true }: { id: string; name: string; portrait?: string | null; label: string; onPress: () => void; disabled?: boolean; main?: boolean }) {
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
      <PersonSeal id={id} name={name} portrait={portrait} size={44} />
      <Text numberOfLines={1} style={[typography.print, { color: colors.ink, flex: 1, fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  );
}
