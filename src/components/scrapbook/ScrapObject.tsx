import { memo, useEffect, useMemo } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { resolvePhotoUri, type Entry } from '../../data';
import { formatDiaryDate, formatDisplayDate, replyLabel, toLocalDate } from '../../lib/dates';
import { tapHaptic } from '../../lib/haptics';
import { lookForEntry, type EntryLook } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { DiaryPage } from './DiaryPage';
import { Raster } from './Raster';
import { deg } from './shared';
import type { VoicePlayer } from './Waveform';
import type { NoteEditor } from './WritableText';

/** A page lies only a little crooked: this share of the seeded tilt. */
const PAGE_TILT = 0.3;

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
  /** Kept for callers from the scrapbook days (tape, sticker, turning a polaroid over); a diary page has none of these. */
  onPressTape?: () => void;
  onPressSticker?: () => void;
  flipped?: boolean;
  /** Write on the page itself (the writing page). */
  editor?: NoteEditor;
  /** Write back to your past self on the page itself (a memory that came back). */
  replyEditor?: NoteEditor;
  /** Listen to the voice note on it (the memory page). Its reels turn as it plays, so it isn't a texture then. */
  voicePlayer?: VoicePlayer;
  style?: StyleProp<ViewStyle>;
}

/** An entry as a page of the diary (`DiaryPage`), a little crooked, lifting under the finger when it can be opened. */
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
  replyEditor,
  voicePlayer,
  style,
}: Props) {
  const theme = useTheme();
  const { motion } = theme;
  const seededLook = useLook(entry);
  const look = lookOverride ?? seededLook;
  const reduceMotion = useReducedMotion();

  const pressed = useSharedValue(0);
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
  const text = editor ? editor.value : entry.text;
  const hasVoice = entry.voicePath !== null;

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pressed.get() * motion.pressedLift },
      { scale: 1 + pressed.get() * (motion.pressedScale - 1) },
    ],
  }));
  const settleStyle = useAnimatedStyle(() => ({ opacity: tapeIn.get() > 0.5 ? 1 : 0.85 + tapeIn.get() * 0.3 }));

  // Every memory is a page of the diary, lying just a little crooked on the leather.
  const drawn = (
    <Animated.View style={[{ width, transform: [{ rotate: deg(look.tilt * PAGE_TILT) }] }, liftStyle, settleStyle]}>
      <DiaryPage
        width={width}
        text={text}
        uri={uri}
        date={formatDiaryDate(entry.localDate)}
        voice={hasVoice ? { ms: entry.voiceMs, player: voicePlayer } : undefined}
        numberOfLines={numberOfLines}
        lift={lift}
        editor={editor}
        // A sealed reply is headed by when it was written; one being written now, by today.
        reply={entry.reply && !replyEditor ? { text: entry.reply, label: replyLabel(entry.localDate, entry.repliedAt ? toLocalDate(new Date(entry.repliedAt)) : entry.localDate) } : replyEditor ? { text: '', label: replyLabel(entry.localDate, toLocalDate(new Date())) } : null}
        replyEditor={replyEditor}
      />
    </Animated.View>
  );

  // Kept as a texture whenever nothing inside it moves, so dropping in or sliding is just moving a picture (drawn live,
  // a photo polaroid with its film and shadows cost 14–26 ms a frame). Off while something inside animates: a swaying
  // clip, a flickering tape, a developing photo, typing, the voice note playing, or a turn-over. Always the same view,
  // only the flag changes, so nothing inside is rebuilt.
  const textured = raster && !tapeFlicker && !develop && !editor && !replyEditor && !voicePlayer?.playing;
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
      accessibilityRole="button"
      accessibilityLabel={`Memory from ${formatDisplayDate(entry.localDate)}`}
    >
      {content}
    </Pressable>
  );
});
