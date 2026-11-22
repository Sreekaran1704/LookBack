import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { toggleHaptic } from '../../lib/haptics';
import { formatVoiceMs } from '../../lib/voice';
import { useTheme } from '../../theme';
import { vintageFilm } from './shared';
import type { VoicePlayer } from './Waveform';
import { WritableText, type NoteEditor } from './WritableText';

interface Props {
  width: number;
  /** The person's words (handwritten in blue-black ink on the ruled lines). */
  text: string;
  /** A photo, tucked in with four photo corners. */
  uri?: string | null;
  /** The date at the top of the page ("The 20th of November, 2025"). */
  date: string;
  /** A voice memory: a small cassette tucked into a paper pocket glued to the page. */
  voice?: { ms: number | null; player?: VoicePlayer };
  numberOfLines?: number;
  lift?: number;
  /** Write on the page itself (the writing page). */
  editor?: NoteEditor;
  /**
   * What you wrote back to your past self when this came back, in sepia under the original ("a year on"). With
   * `replyEditor` it is a text box: you write the reply on the page itself.
   */
  reply?: { text: string; label: string } | null;
  replyEditor?: NoteEditor;
}

/** Sizes are set for a page this wide and scale with it, so a small page on Home reads like a big one, only smaller. */
const BASE_WIDTH = 320;
const MARGIN_AT = 18;
const PAD_LEFT = 30;
const PAD_RIGHT = 18;
const PAD_TOP = 16;
const PAD_BOTTOM = 18;
const HAND_SIZE = 23;
const HAND_LINE = 28;
const DATE_SIZE = 16;
const PHOTO_RATIO = 0.75;
const CORNER = 16;
const POCKET_RATIO = 0.42;
/** Two more pages show under this one, a few points out. */
const PAGE_EDGE = 3;
const REEL_SPIN_MS = 1500;
/** The cassette's dark shell, the reels' hubs and the tape wound on them. */
const TAPE_SHELL = '#2A2118';
const REEL_DARK = '#1A140E';
const REEL_TAPE = '#3A2A1A';

/**
 * A memory as a page of the diary: aged cream paper bound on the left (a red margin line), the date at the top in
 * sepia print, a photo held by photo corners, a voice memory as a cassette in a paper pocket, and the person's own
 * words handwritten in blue-black ink on ruled lines. No tape, stickers or tilt: it's a page, not a scrap.
 */
export const DiaryPage = memo(function DiaryPage({ width, text, uri, date, voice, numberOfLines, lift = 1, editor, reply, replyEditor }: Props) {
  const theme = useTheme();
  const { colors, typography } = theme;
  const k = width / BASE_WIDTH;
  const handSize = Math.max(17, HAND_SIZE * k);
  const lineH = Math.round(handSize * (HAND_LINE / HAND_SIZE));
  const [wordsH, setWordsH] = useState(0);
  const onWords = (e: LayoutChangeEvent) => setWordsH(e.nativeEvent.layout.height);
  const inner = width - (PAD_LEFT + PAD_RIGHT) * k;
  const hasWords = text.trim().length > 0 || editor !== undefined;
  const ruled = Math.max(1, Math.floor(wordsH / lineH));
  const shape = { borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 7 * k, borderBottomRightRadius: 7 * k };

  return (
    <View style={{ width }}>
      {/* The pages underneath, a few points out. */}
      <View style={[StyleSheet.absoluteFill, shape, { backgroundColor: colors.paper, opacity: 0.55, transform: [{ translateX: PAGE_EDGE }, { translateY: PAGE_EDGE }] }]} />
      <View
        style={[
          shape,
          {
            backgroundColor: colors.paper,
            paddingLeft: PAD_LEFT * k,
            paddingRight: PAD_RIGHT * k,
            paddingTop: PAD_TOP * k,
            paddingBottom: PAD_BOTTOM * k,
            gap: 10 * k,
            boxShadow: theme.shadow(undefined, lift),
            // Light falls across the page from the top left; the far corner is a touch aged.
            backgroundImage: `radial-gradient(circle at 100% 0%, rgba(150,110,50,0.16) 0%, rgba(150,110,50,0) 45%), radial-gradient(circle at 0% 100%, rgba(150,110,50,0.12) 0%, rgba(150,110,50,0) 40%)`,
          },
        ]}
      >
        <View style={{ position: 'absolute', left: MARGIN_AT * k, top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.marginLine }} />
        <Text numberOfLines={1} style={[typography.caption, { color: colors.sepia, fontSize: DATE_SIZE * Math.max(0.8, k), lineHeight: DATE_SIZE * Math.max(0.8, k) * 1.3 }]}>
          {date}
        </Text>

        {uri ? <TuckedPhoto uri={uri} width={inner} k={k} /> : null}
        {voice ? <TapePocket width={inner} k={k} ms={voice.ms} player={voice.player} /> : null}

        {hasWords ? (
          <View onLayout={onWords}>
            {/* Ruled lines under the handwriting, one per line of it. */}
            {wordsH > 0
              ? Array.from({ length: ruled }, (_, i) => (
                  <View key={i} pointerEvents="none" style={{ position: 'absolute', left: -PAD_LEFT * k * 0.35, right: 0, top: (i + 1) * lineH - 2, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.ruleLine }} />
                ))
              : null}
            <WritableText
              text={text}
              editor={editor}
              numberOfLines={numberOfLines}
              style={[typography.hand, { color: colors.inkBlue, fontSize: handSize, lineHeight: lineH }]}
            />
          </View>
        ) : null}

        {reply || replyEditor ? (
          // The reply: a little further in, a sepia rule beside it, headed with how long after it was written.
          <View style={{ marginTop: 6 * k, paddingLeft: 12 * k, borderLeftWidth: 1, borderLeftColor: colors.marginLine, gap: 2 * k }}>
            <Text style={[typography.caption, { color: colors.sepia, fontSize: DATE_SIZE * Math.max(0.8, k) * 0.9, lineHeight: DATE_SIZE * Math.max(0.8, k) * 1.2 }]}>
              {reply?.label ?? 'a year on'}:
            </Text>
            <WritableText
              text={reply?.text ?? ''}
              editor={replyEditor}
              numberOfLines={numberOfLines}
              style={[typography.hand, { color: colors.sepia, fontSize: handSize, lineHeight: lineH }]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

/** A photo slipped into four dark paper photo corners, printed like an old photograph. */
function TuckedPhoto({ uri, width, k }: { uri: string; width: number; k: number }) {
  const theme = useTheme();
  const { colors } = theme;
  const h = width * PHOTO_RATIO;
  const c = CORNER * k;
  const corner = colors.ink;
  return (
    <View style={{ width, height: h, padding: 4 * k, backgroundColor: colors.paperWhite, boxShadow: '0px 1px 3px rgba(0,0,0,0.25)' }}>
      <View style={[{ flex: 1 }, vintageFilm(theme)]}>
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={theme.motion.imageFadeMs} cachePolicy="memory-disk" />
      </View>
      {/* Four photo corners: a dark triangle over each corner of the print. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -2, top: -2, width: 0, height: 0, borderTopWidth: c, borderRightWidth: c, borderTopColor: corner, borderRightColor: 'transparent' }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -2, top: -2, width: 0, height: 0, borderTopWidth: c, borderLeftWidth: c, borderTopColor: corner, borderLeftColor: 'transparent' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: -2, bottom: -2, width: 0, height: 0, borderBottomWidth: c, borderRightWidth: c, borderBottomColor: corner, borderRightColor: 'transparent' }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -2, bottom: -2, width: 0, height: 0, borderBottomWidth: c, borderLeftWidth: c, borderBottomColor: corner, borderLeftColor: 'transparent' }} />
    </View>
  );
}

/** A cassette tucked into a paper pocket glued to the page. Tap it to listen; its reels turn while it plays. */
function TapePocket({ width, k, ms, player }: { width: number; k: number; ms: number | null; player?: VoicePlayer }) {
  const { colors, typography } = useTheme();
  const reduceMotion = useReducedMotion();
  const h = width * POCKET_RATIO;
  const tapeW = width * 0.86;
  const tapeH = h * 0.92;
  const reel = tapeH * 0.3;
  const spin = useSharedValue(0);
  const playing = player?.playing ?? false;

  useEffect(() => {
    if (!playing || reduceMotion) {
      cancelAnimation(spin);
      return;
    }
    spin.set(withRepeat(withTiming(spin.get() + 360, { duration: REEL_SPIN_MS, easing: Easing.linear }), -1, false));
  }, [playing, reduceMotion, spin]);
  const reelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.get()}deg` }] }));

  const tape = (
    <View style={{ height: h + tapeH * 0.15, alignItems: 'center' }}>
      {/* The cassette, sticking up out of the pocket. */}
      <View style={{ width: tapeW, height: tapeH, borderRadius: 5 * k, backgroundColor: TAPE_SHELL, padding: 6 * k, transform: [{ rotate: '-2.5deg' }], boxShadow: '0px 3px 6px rgba(0,0,0,0.35)' }}>
        <View style={{ height: tapeH * 0.34, borderRadius: 3 * k, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 * k }}>
          <Text numberOfLines={1} style={[typography.hand, { color: colors.inkBlue, fontSize: 17 * k, lineHeight: 20 * k, flex: 1 }]}>
            a voice note
          </Text>
          <Text style={[typography.stamp, { color: colors.sepia, fontSize: 11 * k, lineHeight: 14 * k }]}>{formatVoiceMs(ms)}</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tapeW * 0.12 }}>
          {[0, 1].map((i) => (
            <Animated.View
              key={i}
              style={[
                {
                  width: reel,
                  height: reel,
                  borderRadius: reel / 2,
                  backgroundImage: `radial-gradient(circle, ${colors.gilt} 0%, ${colors.gilt} 18%, ${REEL_DARK} 22%, ${REEL_DARK} 34%, ${colors.gilt} 38%, ${colors.gilt} 46%, ${REEL_TAPE} 52%)`,
                },
                reelStyle,
              ]}
            >
              {/* Teeth, so the turning shows. */}
              {[0, 60, 120].map((a) => (
                <View key={a} style={{ position: 'absolute', left: reel / 2 - 1, top: reel * 0.12, width: 2, height: reel * 0.76, backgroundColor: REEL_DARK, transform: [{ rotate: `${a}deg` }] }} />
              ))}
            </Animated.View>
          ))}
        </View>
      </View>
      {/* The pocket: a slip of deeper paper over the bottom of the tape, glued along its edges. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.4, backgroundColor: colors.kraft, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderTopWidth: 1, borderTopColor: 'rgba(90,60,30,0.35)', boxShadow: 'inset 0px 6px 8px -6px rgba(90,60,30,0.45)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 * k }}>
        <Text style={[typography.handSmall, { color: colors.ink, fontSize: 13 * Math.max(0.85, k), lineHeight: 17 * Math.max(0.85, k), opacity: 0.75 }]}>
          {player ? (playing ? 'playing…' : 'tap the tape to listen') : 'a tape, tucked into the page'}
        </Text>
      </View>
    </View>
  );

  if (!player) return tape;
  return (
    <Pressable
      onPress={() => {
        toggleHaptic(!playing);
        player.toggle();
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause the voice note' : 'Play the voice note'}
    >
      {tape}
    </Pressable>
  );
}
