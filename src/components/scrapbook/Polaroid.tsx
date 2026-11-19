import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { POLAROID_CHARS_PER_LINE, PTO, planPolaroidWords } from '../../lib/polaroid';
import { useTheme, withAlpha } from '../../theme';
import { deg, vintageFilm } from './shared';
import { formatVoiceMs } from '../../lib/voice';
import { PlayButton, VoiceRow, Waveform, type VoicePlayer } from './Waveform';
import { WritableText, type NoteEditor } from './WritableText';

interface PolaroidProps {
  width: number;
  uri: string | null;
  /** The memory's words: on the bottom strip when they fit, else on the back with "P.T.O" on the front. */
  words?: string;
  /** The day, written on the strip when there are no words, and at the foot of the back. */
  date?: string;
  /** Shadow tint (year color); also the ink of "P.T.O" and the hearts. */
  tint: string;
  /** Fade from white to the photo, like an instant photo developing. */
  develop?: boolean;
  captionTilt?: number;
  lift?: number;
  /** Show the back (animated turn). */
  flipped?: boolean;
  /** Write on the polaroid itself: on the strip, or on the back once the words outgrow it. */
  editor?: NoteEditor;
  /**
   * A voice note. With a photo, its waveform fills the strip under the photo and the words go on the
   * back (while writing, `flipped` decides which side you see). Without a photo the waveform is the
   * picture, and the words go on the strip as usual.
   */
  voice?: { wave: readonly number[] | null; ms: number | null; player?: VoicePlayer };
}

/** Height of the bottom strip (share of the photo), like a real instant photo. */
const STRIP_RATIO = 0.27;
/** Handwriting on the strip: sized so POLAROID_CHARS_PER_LINE letters fill a line (Caveat runs ~0.45 em a letter). */
const LETTER_EM = 0.45;
const LINE_EM = 1.08;
/** The back is written a little smaller, so more fits. */
const BACK_SCALE = 0.78;
const PERSPECTIVE = 1100;
/** Instant film: a soft dark vignette, a faint warm cast, and a glossy sheen across the print. */
const VIGNETTE = 0.36;
const WARM = '#FFB347';
const WARM_ALPHA = 0.12;
/** Old film's faded blacks: a thin wash of cream over the print. */
const FADE = '#FFF1D6';
const FADE_ALPHA = 0.1;
const SHEEN = 0.16;
/** The photo sits a little below the card's surface: a thin shade along its top and left edges. */
const INSET = 0.22;
const FILM_EDGE = '#000000';
const FILM_LIGHT = '#FFFFFF';
const HEARTS = [
  { x: 0.72, rise: 1, size: 1, delay: 0 },
  { x: 0.84, rise: 0.75, size: 0.75, delay: 90 },
  { x: 0.6, rise: 0.6, size: 0.6, delay: 170 },
];

/** White instant-photo frame with a deep bottom strip of handwriting, and a back you can turn it over to. */
export const Polaroid = memo(function Polaroid({
  width,
  uri,
  words = '',
  date,
  tint,
  develop = false,
  captionTilt = -2,
  lift = 1,
  flipped = false,
  editor,
  voice,
}: PolaroidProps) {
  const theme = useTheme();
  const { colors, sizes, typography, spacing, motion } = theme;
  const border = sizes.polaroidBorder;
  const photo = width - border * 2;
  const stripH = Math.max(sizes.polaroidCaption, photo * STRIP_RATIO);
  const height = border + photo + stripH;
  const fontSize = photo / (POLAROID_CHARS_PER_LINE * LETTER_EM);
  const hand = { ...typography.hand, fontSize, lineHeight: fontSize * LINE_EM };
  const backHand = { ...typography.hand, fontSize: fontSize * BACK_SCALE, lineHeight: fontSize * BACK_SCALE * 1.25 };
  const voiceOnStrip = voice !== undefined && uri !== null;
  const voiceInPrint = voice !== undefined && uri === null;
  const plan = planPolaroidWords(editor ? editor.value : words, undefined, undefined, voiceOnStrip);
  // With the waveform on the strip there is always a back to write on while writing, even before the first word.
  const hasBack = plan.back !== null || (editor !== undefined && voiceOnStrip);
  const reduceMotion = useReducedMotion();
  // Crowds (the year pile) skip the film effects to stay cheap.
  const film = !theme.lite;

  // While writing, the polaroid turns over by itself once the words outgrow the strip, and back when they fit again.
  const showBack = editor ? (voiceOnStrip ? flipped : plan.back !== null) : flipped && hasBack;

  const fog = useSharedValue(develop ? 1 : 0);
  useEffect(() => {
    if (!develop) return;
    fog.set(1);
    fog.set(withTiming(0, { duration: reduceMotion ? motion.imageFadeMs : motion.photoDevelopMs }));
  }, [develop, uri, fog, motion.imageFadeMs, motion.photoDevelopMs, reduceMotion]);
  const fogStyle = useAnimatedStyle(() => ({ opacity: fog.get() }));

  // 0 = front up, 1 = back up. The turn lifts the card, leans it, and lands it with a little bounce.
  const turn = useSharedValue(showBack ? 1 : 0);
  const hearts = useSharedValue(0);
  // Turned at least once since it appeared: only then does the keyboard follow the words to the other side.
  const [shownSide, setShownSide] = useState(showBack);
  const [turned, setTurned] = useState(false);
  if (shownSide !== showBack) {
    setShownSide(showBack);
    setTurned(true);
  }
  const writingOnBack = showBack;
  const first = useRef(true);
  useEffect(() => {
    const target = showBack ? 1 : 0;
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) {
      turn.set(withTiming(target, { duration: motion.imageFadeMs }));
      return;
    }
    turn.set(withTiming(target, { duration: motion.flipMs, easing: Easing.inOut(Easing.cubic) }));
    hearts.set(0);
    hearts.set(withDelay(motion.flipMs * 0.8, withSequence(withTiming(1, { duration: motion.flipHeartsMs, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }))));
  }, [showBack, reduceMotion, turn, hearts, motion.flipMs, motion.flipHeartsMs, motion.imageFadeMs]);

  const cardStyle = useAnimatedStyle(() => {
    const t = turn.get();
    // Front up and still: no 3D transform at all. Touches can't find buttons through a perspective
    // transform on Android, so the play button on the strip would never get its tap.
    if (reduceMotion || t === 0) return { transform: [] };
    const air = Math.sin(Math.PI * t);
    return {
      transform: [
        { perspective: PERSPECTIVE },
        { translateY: -air * motion.flipLiftPx },
        { scale: 1 + air * motion.flipScale },
        { rotateZ: `${-air * motion.flipLeanDeg}deg` },
        { rotateY: `${t * 180}deg` },
      ],
    };
  });
  // Each side shows only while it faces you (also on phones that ignore backface visibility), and darkens as it turns away.
  const frontStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? 1 - turn.get() : turn.get() < 0.5 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? turn.get() : turn.get() >= 0.5 ? 1 : 0 }));
  const frontShade = useAnimatedStyle(() => ({ opacity: interpolate(turn.get(), [0, 0.5], [0, 0.45], 'clamp') }));
  const backShade = useAnimatedStyle(() => ({ opacity: interpolate(turn.get(), [0.5, 1], [0.45, 0], 'clamp') }));

  const frontWords = plan.front ?? (editor ? '' : null);
  const voiceRowH = Math.round(stripH * 0.46);
  const strip = voice && voiceOnStrip ? (
    // The voice note's waveform on the strip, and a "P.T.O" when there are words on the back.
    <View style={{ height: stripH, justifyContent: 'center', paddingHorizontal: spacing.xs, gap: spacing.xs }}>
      <VoiceRow wave={voice.wave} ms={voice.ms} width={photo - spacing.xs * 2} height={voiceRowH} color={tint} player={voice.player} />
      {plan.back ? (
        <Text numberOfLines={1} style={[hand, { color: tint, fontFamily: typography.label.fontFamily, fontSize: fontSize * 0.8, lineHeight: fontSize * 0.9, textAlign: 'left' }]}>
          {`${PTO} ↻`}
        </Text>
      ) : null}
    </View>
  ) : (
    <View style={{ height: stripH, justifyContent: 'center', paddingHorizontal: spacing.xs, transform: [{ rotate: deg(captionTilt) }] }}>
      {editor && !plan.back ? (
        <WritableText text={editor.value} editor={{ ...editor, placeholder: 'a few words on the polaroid…' }} style={[hand, { color: colors.ink }]} focusOnMount={turned && !writingOnBack} />
      ) : frontWords ? (
        <Text style={[hand, { color: colors.ink }]} numberOfLines={2}>
          {frontWords}
        </Text>
      ) : plan.teaser ? (
        <Text style={[hand, { color: colors.ink }]} numberOfLines={2}>
          {`${plan.teaser}… `}
          <Text style={{ color: tint, fontFamily: typography.label.fontFamily }}>{`${PTO} ↻`}</Text>
        </Text>
      ) : date ? (
        <Text style={[hand, { color: colors.ink }]} numberOfLines={1}>
          {date}
        </Text>
      ) : null}
    </View>
  );

  const pad = spacing.md;
  const ruled = Math.max(0, Math.floor((height - pad * 2) / backHand.lineHeight) - 1);
  const back = (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper, borderRadius: theme.radii.paper, padding: pad, overflow: 'hidden', transform: reduceMotion ? [] : [{ rotateY: '180deg' }], boxShadow: theme.shadow(tint, lift) }]}>
      {/* Faint ruled lines, a margin, and a little heart doodle in the corner: the back of a photo you wrote on. */}
      <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
        {Array.from({ length: ruled }, (_, i) => {
          const y = pad + backHand.lineHeight * (i + 1);
          return <Line key={i} x1={pad * 0.5} x2={width - pad * 0.5} y1={y} y2={y} stroke={colors.ruleLine} strokeWidth={1} />;
        })}
        <Path
          d={`M ${width - pad * 2.2} ${height - pad * 1.6} c -4 -5 -11 -1 -6 5 l 6 6 l 6 -6 c 5 -6 -2 -10 -6 -5 z`}
          fill={withAlpha(tint, 0.85)}
        />
      </Svg>
      <View style={{ flex: 1 }}>
        {editor && (plan.back || voiceOnStrip) ? (
          <WritableText text={editor.value} editor={voiceOnStrip ? { ...editor, placeholder: 'a few words on the back…' } : editor} style={[backHand, { color: colors.ink }]} focusOnMount={turned && writingOnBack} />
        ) : (
          <Text style={[backHand, { color: colors.ink }]} numberOfLines={Math.max(1, ruled - 1)}>
            {plan.back ?? ''}
          </Text>
        )}
      </View>
      {date ? <Text style={[typography.handSmall, { color: colors.inkMuted, fontSize: backHand.fontSize * 0.85, lineHeight: backHand.fontSize }]}>{date}</Text> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }, backShade]} />
    </View>
  );

  return (
    <View style={{ width, height }}>
      <Animated.View style={[{ width, height }, cardStyle]}>
        <Animated.View
          pointerEvents={showBack ? 'none' : 'auto'}
          style={[
            {
              width,
              height,
              backgroundColor: colors.paperWhite,
              padding: border,
              paddingBottom: 0,
              borderRadius: theme.radii.paper,
              boxShadow: theme.shadow(tint, lift),
            },
            frontStyle,
          ]}
        >
          {/* The card: matte, a touch brighter where the light falls, with a thin darker edge for its thickness. */}
          {/* The card: matte, a touch brighter where the light falls, with a thin darker edge for its thickness.
              Native gradients (drawn on the GPU), not SVG: an SVG this size is painted on the CPU, ~20 ms each time. */}
          {film ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: theme.radii.paper,
                borderWidth: 1,
                borderColor: withAlpha(colors.ink, 0.12),
                backgroundImage: `linear-gradient(158deg, ${withAlpha(FILM_LIGHT, 0.5)} 0%, ${withAlpha(FILM_LIGHT, 0)} 60%, ${withAlpha(FILM_EDGE, 0.05)} 100%)`,
              }}
            />
          ) : null}
          <View style={{ width: photo, height: photo, backgroundColor: colors.inkFaint, overflow: 'hidden', borderRadius: 1.5 }}>
            {voice && voiceInPrint ? <SoundPrint size={photo} tint={tint} wave={voice.wave} ms={voice.ms} player={voice.player} /> : null}
            {uri ? (
              <View style={[{ width: photo, height: photo }, vintageFilm(theme)]}>
                <Image source={{ uri }} recyclingKey={uri} cachePolicy="memory" style={{ width: photo, height: photo }} contentFit="cover" transition={motion.imageFadeMs} />
              </View>
            ) : null}
            {uri && film ? (
              // Old instant film over the print: a warm cast, a faded wash, a vignette, a glossy sheen, and the print sunk into the
              // card (shade along its top and left, a hairline of light bottom and right). Native gradients, drawn on the GPU.
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(WARM, WARM_ALPHA) }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(FADE, FADE_ALPHA) }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundImage: `radial-gradient(circle farthest-corner at 50% 48%, ${withAlpha(FILM_EDGE, 0)} 55%, ${withAlpha(FILM_EDGE, VIGNETTE)} 100%)` }]} />
                <View style={[StyleSheet.absoluteFill, { backgroundImage: `linear-gradient(135deg, ${withAlpha(FILM_LIGHT, 0)} 18%, ${withAlpha(FILM_LIGHT, SHEEN)} 32%, ${withAlpha(FILM_LIGHT, 0)} 46%)` }]} />
                <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 2, backgroundColor: withAlpha(FILM_EDGE, INSET) }} />
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: withAlpha(FILM_EDGE, INSET * 0.7) }} />
                <View style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 1, backgroundColor: withAlpha(FILM_LIGHT, 0.5) }} />
                <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 1, backgroundColor: withAlpha(FILM_LIGHT, 0.4) }} />
              </View>
            ) : null}
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: colors.paperWhite }, fogStyle]} />
          </View>
          {strip}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, borderRadius: theme.radii.paper }, frontShade]} />
        </Animated.View>
        {/* Only the side facing you takes touches: the hidden one is still there (just see-through) and would catch them. */}
        {hasBack ? (
          <Animated.View pointerEvents={showBack ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, backStyle]}>
            {back}
          </Animated.View>
        ) : null}
      </Animated.View>
      {/* Hearts float up when it lands. */}
      {hasBack && !reduceMotion
        ? HEARTS.map((h, i) => <Heart key={i} progress={hearts} x={width * h.x} y={height * 0.12} rise={height * 0.28 * h.rise} size={fontSize * 0.9 * h.size} delay={h.delay / motion.flipHeartsMs} color={tint} />)
        : null}
    </View>
  );
});

/**
 * The picture of a voice memory that has no photo: its waveform, big, printed in the year's color on a
 * softly tinted print, with the play button and how long it is underneath.
 */
function SoundPrint({ size, tint, wave, ms, player }: { size: number; tint: string; wave: readonly number[] | null; ms: number | null; player?: VoicePlayer }) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const button = Math.round(size * 0.17);
  const fontSize = size * 0.09;
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, backgroundColor: colors.paper }]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: `radial-gradient(circle farthest-corner at 40% 35%, ${withAlpha(tint, 0.1)} 0%, ${withAlpha(tint, 0.32)} 100%)` }]} />
      <Waveform wave={wave} width={size * 0.8} height={size * 0.4} color={tint} progress={player?.progress} playing={player?.playing} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <PlayButton size={button} color={tint} player={player} label={formatVoiceMs(ms)} />
        <Text style={[typography.label, { color: colors.ink, fontSize, lineHeight: fontSize * 1.2 }]}>{formatVoiceMs(ms)} </Text>
      </View>
    </View>
  );
}

function Heart({ progress, x, y, rise, size, delay, color }: { progress: { get: () => number }; x: number; y: number; rise: number; size: number; delay: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (progress.get() - delay) / (1 - delay)));
    return {
      opacity: p <= 0 || p >= 1 ? 0 : p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8,
      transform: [{ translateY: -p * rise }, { scale: 0.6 + p * 0.6 }, { rotate: `${(p - 0.5) * 30}deg` }],
    };
  });
  return (
    <Animated.Text pointerEvents="none" style={[{ position: 'absolute', left: x, top: y, fontSize: size, color }, style]}>
      ♥
    </Animated.Text>
  );
}

interface TapedPhotoProps {
  width: number;
  uri: string;
  tint: string;
  /** Show black photo corners instead of relying on tape. */
  corners?: boolean;
  lift?: number;
}

const CORNER = 18;

/** A plain print with a thin white border, held by photo corners or tape. */
export const TapedPhoto = memo(function TapedPhoto({ width, uri, tint, corners = false, lift = 1 }: TapedPhotoProps) {
  const theme = useTheme();
  const { colors, spacing, motion } = theme;
  const inner = width - spacing.xs * 2;
  const height = inner * 1.25;
  const cornerColor = theme.colors.ink;
  const corner = (rotation: number, pos: object) => (
    <View style={[{ position: 'absolute', width: CORNER, height: CORNER, transform: [{ rotate: deg(rotation) }] }, pos]}>
      <Svg width={CORNER} height={CORNER}>
        <Path d={`M0 0 L${CORNER} 0 L0 ${CORNER} Z`} fill={cornerColor} opacity={0.85} />
      </Svg>
    </View>
  );
  return (
    <View
      style={{
        width,
        padding: spacing.xs,
        backgroundColor: colors.paperWhite,
        boxShadow: theme.shadow(tint, lift),
      }}
    >
      <View style={vintageFilm(theme)}>
        <Image source={{ uri }} recyclingKey={uri} cachePolicy="memory" style={{ width: inner, height }} contentFit="cover" transition={motion.imageFadeMs} />
      </View>
      {corners ? (
        <>
          {corner(0, { left: -2, top: -2 })}
          {corner(90, { right: -2, top: -2 })}
          {corner(180, { right: -2, bottom: -2 })}
          {corner(270, { left: -2, bottom: -2 })}
        </>
      ) : null}
    </View>
  );
});
