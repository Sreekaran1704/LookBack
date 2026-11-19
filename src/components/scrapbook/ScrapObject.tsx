import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
import type { VoicePlayer } from './Waveform';
import { WashiTape } from './WashiTape';
import type { NoteEditor } from './WritableText';

export function useLook(entry: Entry): EntryLook {
  const { scrap } = useTheme();
  return useMemo(
    () => lookForEntry(entry, scrap.maxTilt, scrap.maxOffset),
    // Only the fields that affect the look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id, entry.text, entry.photoPath, entry.voicePath, entry.objectType, entry.tapePattern, entry.sticker, entry.tapeColor, scrap.maxTilt, scrap.maxOffset],
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
  /** Make the tape (or clip/pin) and the sticker tappable, e.g. to pick another one on the writing page. A missing sticker shows a dashed spot to tap. */
  onPressTape?: () => void;
  onPressSticker?: () => void;
  /** A polaroid with words on its back: show the back (it turns over). */
  flipped?: boolean;
  /** Write on the object itself (the writing page): the note, the ticket, or the polaroid's strip and back. */
  editor?: NoteEditor;
  /** Listen to the voice note on it (the memory page). Its waveform fills in as it plays, so it isn't a texture. */
  voicePlayer?: VoicePlayer;
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
  onPressTape,
  onPressSticker,
  flipped = false,
  editor,
  voicePlayer,
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

  // A turn-over animates inside the object: no texture while it turns (and its hearts float up).
  const [shownFlip, setShownFlip] = useState(flipped);
  const [turning, setTurning] = useState(false);
  if (shownFlip !== flipped) {
    setShownFlip(flipped);
    setTurning(true);
  }
  useEffect(() => {
    if (!turning) return;
    const t = setTimeout(() => setTurning(false), motion.flipMs + motion.flipHeartsMs);
    return () => clearTimeout(t);
  }, [turning, motion.flipMs, motion.flipHeartsMs]);

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
  const text = editor ? editor.value : entry.text;
  // A photo with words is always a polaroid: the words go on its strip, or on its back with "P.T.O" on the front.
  // A voice note is always a polaroid: with a photo, its waveform goes on the strip under it; without one,
  // the waveform is the picture.
  const hasVoice = entry.voicePath !== null;
  const objectType = hasVoice || (uri !== null && text.trim().length > 0) ? 'polaroid' : look.objectType;
  const voice = hasVoice ? { wave: entry.voiceWave, ms: entry.voiceMs, player: voicePlayer } : undefined;

  let body: React.ReactNode;
  switch (objectType) {
    case 'polaroid':
      body = (
        <Polaroid
          width={width}
          uri={uri}
          words={text}
          date={formatDisplayDate(entry.localDate)}
          tint={palette.primary}
          develop={develop}
          lift={lift}
          flipped={flipped}
          editor={editor}
          voice={voice}
        />
      );
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
          text={text}
          paper={palette.tint}
          accent={palette.primary}
          stubLabel={String(year)}
          serial={String(look.pathSeed % 10000).padStart(4, '0')}
          lift={lift}
          editor={editor}
        />
      );
      break;
    case 'tornNote':
      body = (
        <TornNote
          width={width}
          text={text}
          paper={notePaper}
          tint={palette.primary}
          seed={look.pathSeed}
          ruled={look.sizeJitter < 0.65}
          folded={look.folded}
          numberOfLines={numberOfLines}
          lift={lift}
          editor={editor}
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
      {/* Tap targets over the tape and the sticker (the writing page's live preview). */}
      {onPressTape ? (
        <Pressable
          onPress={() => {
            tapHaptic();
            onPressTape();
          }}
          accessibilityRole="button"
          accessibilityLabel="Change the tape"
          hitSlop={sizes.hitSlop}
          style={{ position: 'absolute', top: -sizes.tapeHeight, left: (width - tapeWidth) / 2 - sizes.hitSlop, width: tapeWidth + sizes.hitSlop * 2, height: sizes.tapeHeight * 2 }}
        />
      ) : null}
      {onPressSticker ? (
        <Pressable
          onPress={() => {
            tapHaptic();
            onPressSticker();
          }}
          accessibilityRole="button"
          accessibilityLabel={showSticker ? 'Change the sticker' : 'Add a sticker'}
          hitSlop={sizes.hitSlop}
          style={[stickerPos, { width: sizes.sticker, height: sizes.sticker, alignItems: 'center', justifyContent: 'center' }]}
        >
          {showSticker ? null : (
            <View style={{ width: sizes.sticker, height: sizes.sticker, borderRadius: sizes.sticker / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: stickerPalette.primary, backgroundColor: colors.paperWhite, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[theme.typography.label, { color: stickerPalette.primary, paddingRight: 0 }]}>+</Text>
            </View>
          )}
        </Pressable>
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

  // Kept as a texture whenever nothing inside it moves, so dropping in or sliding is just moving a picture (drawn live,
  // a photo polaroid with its film and shadows cost 14–26 ms a frame). Off while something inside animates: a swaying
  // clip, a flickering tape, a developing photo, typing, the voice note playing, or a turn-over. Always the same view,
  // only the flag changes, so nothing inside is rebuilt.
  const swaying = sway && look.fastener === 'clip';
  const textured = raster && !swaying && !tapeFlicker && !develop && !editor && !voicePlayer?.playing && !turning;
  const content = <Raster enabled={textured}>{drawn}</Raster>;

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
