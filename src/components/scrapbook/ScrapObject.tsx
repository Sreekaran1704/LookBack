import { memo, useEffect, useMemo } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { resolvePhotoUri, type Entry } from '../../data';
import { formatDisplayDate, parseLocalDate } from '../../lib/dates';
import { tapHaptic } from '../../lib/haptics';
import { lookForEntry, type EntryLook } from '../../lib/seeded';
import { firstLine } from '../../notifications/planner';
import { paletteByName, useTheme } from '../../theme';
import { DateStamp } from './DateStamp';
import { PaperClip } from './PaperClip';
import { Pin } from './Pin';
import { Polaroid, TapedPhoto } from './Polaroid';
import { Raster } from './Raster';
import { deg } from './shared';
import { Sticker } from './Sticker';
import { TicketStub } from './TicketStub';
import { TornNote } from './TornNote';
import { WashiTape } from './WashiTape';

export function useLook(entry: Entry): EntryLook {
  const { scrap } = useTheme();
  return useMemo(
    () => lookForEntry(entry, scrap.maxTilt, scrap.maxOffset),
    // Only the fields that affect the look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id, entry.text, entry.photoPath, entry.objectType, entry.tapePattern, entry.sticker, entry.tapeColor, scrap.maxTilt, scrap.maxOffset],
  );
}

interface Props {
  entry: Entry;
  width: number;
  /** Override the seeded look (e.g. live preview while editing). */
  look?: EntryLook;
  /** Add a rubber date stamp in the corner. */
  stamp?: boolean;
  /** Text lines to show for notes (collages truncate, detail shows all). */
  numberOfLines?: number;
  lift?: number;
  /** Polaroid develops from white (used on the add screen). */
  develop?: boolean;
  /** Override for the photo URI (unsaved picks on the add screen). */
  photoUri?: string | null;
  sway?: boolean;
  /** Tape flickers on, as if just stuck down (save celebration). */
  tapeFlicker?: boolean;
  /** Cache the drawn object as a texture (default). Turn off for crowds, where the textures would cost too much memory. */
  raster?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** An entry as a physical scrapbook object, with its fastener and sticker. */
export const ScrapObject = memo(function ScrapObject({
  entry,
  width,
  look: lookOverride,
  stamp = false,
  numberOfLines,
  lift = 1,
  develop = false,
  photoUri,
  sway = false,
  tapeFlicker = false,
  raster = true,
  onPress,
  style,
}: Props) {
  const theme = useTheme();
  const { colors, sizes, motion, spacing } = theme;
  const seededLook = useLook(entry);
  const look = lookOverride ?? seededLook;
  const year = parseLocalDate(entry.localDate).year;
  const palette = theme.year(year);
  // Colors the person picked for the tape and sticker; otherwise the year's color.
  const tapePalette = paletteByName(entry.tapeColor) ?? palette;
  const stickerPalette = paletteByName(entry.stickerColor) ?? palette;
  const reduceMotion = useReducedMotion();

  const pressed = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const tapeIn = useSharedValue(tapeFlicker && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!tapeFlicker || reduceMotion) return;
    const t = motion.tapeFlickerMs;
    tapeIn.set(
      withSequence(
        withDelay(t * 3, withTiming(1, { duration: t })),
        withTiming(0.2, { duration: t }),
        withTiming(1, { duration: t }),
        withTiming(0.5, { duration: t }),
        withTiming(1, { duration: t }),
      ),
    );
  }, [tapeFlicker, reduceMotion, motion.tapeFlickerMs, tapeIn]);

  const uri = photoUri !== undefined ? photoUri : entry.photoPath ? resolvePhotoUri(entry.photoPath) : null;
  const notePapers = [colors.paper, colors.paperWhite, colors.blush, palette.tint];
  const notePaper = notePapers[Math.floor(look.sizeJitter * notePapers.length)] ?? colors.paper;
  const caption = firstLine(entry.text, 28) || formatDisplayDate(entry.localDate);

  let body: React.ReactNode;
  switch (look.objectType) {
    case 'polaroid':
      body = <Polaroid width={width} uri={uri} caption={caption} tint={palette.primary} develop={develop} lift={lift} />;
      break;
    case 'tapedPhoto':
      body = uri ? (
        <TapedPhoto width={width} uri={uri} tint={palette.primary} corners={look.sizeJitter > 0.5} lift={lift} />
      ) : null;
      break;
    case 'ticket':
      body = (
        <TicketStub
          width={width}
          text={entry.text}
          paper={palette.tint}
          accent={palette.primary}
          stubLabel={String(year)}
          serial={String(look.pathSeed % 10000).padStart(4, '0')}
          lift={lift}
        />
      );
      break;
    case 'tornNote':
      body = (
        <TornNote
          width={width}
          text={entry.text}
          paper={notePaper}
          tint={palette.primary}
          seed={look.pathSeed}
          ruled={look.sizeJitter < 0.65}
          folded={look.folded}
          numberOfLines={numberOfLines}
          lift={lift}
        />
      );
      break;
  }

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pressed.get() * motion.pressedLift },
      { scale: 1 + pressed.get() * (motion.pressedScale - 1) },
    ],
  }));
  const tapeStyle = useAnimatedStyle(() => ({
    opacity: tapeIn.get(),
    transform: [{ translateY: pressed.get() * motion.tapeTug }],
  }));
  const stickerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.get()}deg` }] }));

  const tapeWidth = Math.max(width * sizes.tapeWidthRatio, sizes.tapeHeight * 3);
  const fastener =
    look.fastener === 'tape' ? (
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: -sizes.tapeHeight / 2, left: (width - tapeWidth) / 2 }, tapeStyle]}
      >
        <WashiTape
          width={tapeWidth}
          color={tapePalette.primary}
          color2={tapePalette.secondary}
          pattern={look.tapePattern}
          angle={look.tapeAngle}
        />
      </Animated.View>
    ) : look.fastener === 'clip' ? (
      <PaperClip sway={sway} style={{ position: 'absolute', top: -sizes.clipHeight * 0.35, left: width * 0.16 }} />
    ) : (
      <Pin color={palette.primary} style={{ position: 'absolute', top: -sizes.pinHead * 0.6, left: width / 2 - sizes.pinHead }} />
    );

  // Keep the sticker away from a clip or pin at the top left: move it to the top right instead of hiding it.
  const corner = look.fastener !== 'tape' && look.stickerCorner === 'tl' ? 'tr' : look.stickerCorner;
  const stickerPos: ViewStyle = {
    position: 'absolute',
    [corner.startsWith('t') ? 'top' : 'bottom']: -sizes.sticker * 0.35,
    [corner.endsWith('l') ? 'left' : 'right']: -sizes.sticker * 0.3,
  };
  const showSticker = look.sticker !== null;

  const drawn = (
    <Animated.View style={[{ width, transform: [{ rotate: deg(look.tilt) }] }, liftStyle]}>
      {body}
      {fastener}
      {showSticker && look.sticker ? (
        <Animated.View style={[stickerPos, stickerStyle]} pointerEvents="none">
          <Sticker kind={look.sticker} color={stickerPalette.primary} color2={stickerPalette.secondary} style={{ transform: [{ rotate: deg(look.stickerTilt) }] }} />
        </Animated.View>
      ) : null}
      {stamp ? (
        <DateStamp
          text={formatDisplayDate(entry.localDate)}
          color={palette.primary}
          angle={-look.tilt * 2 - 6}
          style={{ position: 'absolute', right: spacing.sm, bottom: -spacing.lg }}
        />
      ) : null}
    </Animated.View>
  );

  // A swaying clip or a flickering tape animates inside, which would re-draw the texture every frame.
  const content = raster && !sway && !tapeFlicker && !develop ? <Raster>{drawn}</Raster> : drawn;

  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      style={style}
      onPressIn={() => pressed.set(withSpring(1, motion.press))}
      onPressOut={() => pressed.set(withSpring(0, motion.press))}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      onLongPress={() => {
        if (reduceMotion || !look.sticker) return;
        tapHaptic();
        wiggle.set(
          withSequence(
            withTiming(motion.wiggleDeg, { duration: motion.wiggleMs }),
            withTiming(-motion.wiggleDeg, { duration: motion.wiggleMs }),
            withTiming(motion.wiggleDeg / 2, { duration: motion.wiggleMs }),
            withTiming(0, { duration: motion.wiggleMs }),
          ),
        );
      }}
      accessibilityRole="button"
      accessibilityLabel={`Memory from ${formatDisplayDate(entry.localDate)}`}
    >
      {content}
    </Pressable>
  );
});
