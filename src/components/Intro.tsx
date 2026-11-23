import { useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { resolvePhotoUri, type Entry } from '../data';
import { tapHaptic, thudHaptic } from '../lib/haptics';
import { useTheme, withAlpha } from '../theme';
import { Cassette } from './scrapbook/Cassette';

interface Props {
  /** The memories that fast-forward through the tape (newest first). */
  entries: Entry[];
  today: string;
  onDone: () => void;
}

/** The splash's background (app.json → expo-splash-screen → backgroundColor), so nothing jumps when it hides. */
const SPLASH_BG = '#0B0B0C';
/** The cassette, as a share of the screen's width. */
const CASSETTE_SHARE = 0.74;

/** The beats: the tile becomes the cassette, the motor starts, memories fast-forward through it, it opens up. */
const MORPH_MS = 260;
const PLAY_AT_MS = 200;
const BLOOM_AT_MS = 260;
const BLOOM_MS = 1500;
const BLOOM_STAGGER_MS = 140;
const REEL_AT_MS = 420;
const REEL_MS = 1500;
const OPEN_AT_MS = REEL_AT_MS + REEL_MS + 60;
const OPEN_MS = 560;
/** How many memories go through, and how fast the first and last pass (they speed up, like fast-forward). */
const MAX_CHIPS = 14;
const FIRST_PASS_MS = 620;
const LAST_PASS_MS = 170;
const CHIP_W = 64;

/** Sounds: the motor starting with the tape squealing over the head, and the squeal as it runs out. */
const SCREECH_START = require('../../assets/sounds/tape-screech-start.wav');
const SCREECH_END = require('../../assets/sounds/tape-screech-end.wav');
const MOTOR_START = require('../../assets/sounds/tape-start.wav');
const SOUND_VOLUME = 0.5;

function play(player: AudioPlayer) {
  player.seekTo(0).then(() => player.play()).catch(() => undefined);
}
function setVolume(player: AudioPlayer, volume: number) {
  player.volume = volume;
}

interface Chip {
  key: string;
  uri: string | null;
  words: string;
  start: number;
  dur: number;
  dy: number;
  tilt: number;
}

/**
 * The startup moment, built around the diary's cassette. The native splash is only the dark background, so the app opens
 * straight into this: the cassette comes up out of the dark. Its motor starts with a squeal of tape, its reels turn, and
 * watercolour washes bloom out behind it in the paper's colours and the years' colours. Then your memories fast-forward
 * through it, photos and first lines going in one side and out the other, faster and faster, until it runs out with a
 * squeal and opens up, the colour spreading, onto the home page that has been rendering underneath. Tap to skip; with
 * "reduce motion" it is a short fade.
 */
export function Intro({ entries, onDone }: Props) {
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [armed, setArmed] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const exit = useSharedValue(0);
  const morph = useSharedValue(0);
  const reel = useSharedValue(0);
  const open = useSharedValue(0);
  const blooms = useSharedValue(0);
  const leaving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const screechStart = useAudioPlayer(SCREECH_START);
  const screechEnd = useAudioPlayer(SCREECH_END);
  const motor = useAudioPlayer(MOTOR_START);
  useEffect(() => {
    [screechStart, screechEnd, motor].forEach((p) => setVolume(p, SOUND_VOLUME));
  }, [screechStart, screechEnd, motor]);

  const cassW = W * CASSETTE_SHARE;
  const cassH = cassW * 0.63;
  const cx = W / 2;
  const cy = H / 2;
  // The tape's line through the cassette: the middle of its window.
  const tapeY = cy - cassH / 2 + cassH * 0.49;

  // The memories, newest first; photos as little prints, words as slips. With none yet, blank slips go through.
  const chips: Chip[] = useMemo(() => {
    const source = entries.slice(0, MAX_CHIPS);
    const n = Math.max(source.length, 8);
    const list: Chip[] = [];
    for (let i = 0; i < n; i++) {
      const e = source[i];
      const k = n > 1 ? i / (n - 1) : 0;
      const dur = FIRST_PASS_MS + (LAST_PASS_MS - FIRST_PASS_MS) * k;
      const prev = list[i - 1];
      const start = prev ? prev.start + prev.dur * 0.42 : 0;
      list.push({ key: e?.id ?? `blank-${i}`, uri: e?.photoPath ? resolvePhotoUri(e.photoPath) : null, words: e?.text.trim().split('\n')[0]?.slice(0, 28) ?? '', start, dur, dy: ((i * 37) % 11) - 5, tilt: ((i * 53) % 13) - 6 });
    }
    return list;
  }, [entries]);

  // Watercolour: soft blooms in the paper's two accents and this and recent years' colours.
  const bloomColors = useMemo(() => {
    const y = new Date().getFullYear();
    return [theme.paper.dots, theme.year(y).primary, theme.paper.accent2, theme.year(y - 1).primary, theme.year(y - 2).primary, theme.paper.dots];
  }, [theme]);

  const finish = useCallback(() => onDone(), [onDone]);
  const leave = useCallback(
    (fast = false) => {
      if (leaving.current) return;
      leaving.current = true;
      timers.current.forEach(clearTimeout);
      exit.set(
        withTiming(1, { duration: fast ? 220 : OPEN_MS, easing: Easing.out(Easing.cubic) }, (done) => {
          if (done) runOnJS(finish)();
        }),
      );
    },
    [exit, finish],
  );

  // The native splash is only the dark background, the same as this one: hide it as soon as this is on screen and start.
  const onShown = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    setArmed(true);
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(onShown);
    return () => cancelAnimationFrame(frame);
  }, [onShown]);

  useEffect(() => {
    if (!armed) return;
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    if (reduceMotion) {
      morph.set(withTiming(1, { duration: theme.motion.imageFadeMs }));
      at(theme.motion.introReducedHoldMs, () => leave());
    } else {
      morph.set(withTiming(1, { duration: MORPH_MS, easing: Easing.out(Easing.cubic) }));
      at(PLAY_AT_MS, () => {
        thudHaptic();
        play(motor);
        play(screechStart);
        setSpinning(true);
      });
      blooms.set(withDelay(BLOOM_AT_MS, withTiming(1, { duration: BLOOM_MS, easing: Easing.out(Easing.quad) })));
      reel.set(withDelay(REEL_AT_MS, withTiming(1, { duration: REEL_MS, easing: Easing.linear })));
      at(OPEN_AT_MS, () => {
        play(screechEnd);
        setSpinning(false);
      });
      open.set(withDelay(OPEN_AT_MS, withTiming(1, { duration: OPEN_MS, easing: Easing.in(Easing.cubic) })));
      at(OPEN_AT_MS + OPEN_MS * 0.55, () => leave());
    }
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, [armed, reduceMotion, leave, morph, blooms, reel, open, motor, screechStart, screechEnd, theme.motion.imageFadeMs, theme.motion.introReducedHoldMs]);

  const sheetStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const cassStyle = useAnimatedStyle(() => ({
    opacity: morph.get() * (1 - open.get()),
    transform: [{ scale: 0.86 + morph.get() * 0.14 + open.get() * 0.9 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, blooms.get() * 2) * (1 - open.get()), transform: [{ translateY: (1 - Math.min(1, blooms.get() * 2)) * spacing.md }] }));
  const reelTotal = chips.length > 0 ? (chips[chips.length - 1]?.start ?? 0) + (chips[chips.length - 1]?.dur ?? 0) : 1;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG }, sheetStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          tapHaptic();
          leave(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Skip the intro"
      >
        {/* Watercolour blooming out behind the cassette, and spreading over everything as it opens. */}
        {bloomColors.map((c, i) => (
          <Bloom key={i} color={c} index={i} progress={blooms} open={open} cx={cx + ((i % 3) - 1) * W * 0.22} cy={cy + (i % 2 ? -1 : 1) * H * 0.08 + (i - 2.5) * 14} size={W * (0.7 + (i % 3) * 0.18)} />
        ))}

        {/* The memories, fast-forwarding through it: in at the right, out at the left, behind the shell. */}
        {chips.map((chip) => (
          <MemoryChip key={chip.key} chip={chip} reel={reel} total={reelTotal} fromX={W + CHIP_W} toX={-CHIP_W * 2} y={tapeY} paper={colors.panel} ink={colors.ink} />
        ))}

        <Animated.View style={[{ position: 'absolute', left: cx - cassW / 2, top: cy - cassH / 2 }, cassStyle]}>
          <Cassette width={cassW} title="LookBack" detail="C·365" spinning={spinning} played={0.2} />
        </Animated.View>

        <Animated.View style={[styles.title, { top: cy + cassH / 2 + spacing.xl }, titleStyle]}>
          <Text numberOfLines={1} style={[typography.title, { color: theme.paper.light, textAlign: 'center', alignSelf: 'stretch' }]}>
            LookBack{' '}
          </Text>
          <Text style={[typography.caption, { color: withAlpha(theme.paper.light, 0.7), textAlign: 'center', alignSelf: 'stretch' }]}>memories stay, feelings change</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** One watercolour bloom: a soft round of colour that spreads and pales like paint into wet paper, then floods out as it opens. */
function Bloom({ color, index, progress, open, cx, cy, size }: { color: string; index: number; progress: SharedValue<number>; open: SharedValue<number>; cx: number; cy: number; size: number }) {
  const start = (index * BLOOM_STAGGER_MS) / BLOOM_MS;
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (progress.get() - start) / (1 - start)));
    const o = open.get();
    return {
      opacity: p * (0.55 - p * 0.2) * (1 - o * 0.6),
      transform: [{ scale: 0.25 + p * 0.95 + o * 2.2 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          // closest-side: the wash is fully faded by the circle's edge, so no rim shows (paint feathering into wet paper).
          backgroundImage: `radial-gradient(circle closest-side at 50% 50%, ${withAlpha(color, 0.8)} 0%, ${withAlpha(color, 0.5)} 35%, ${withAlpha(color, 0.18)} 65%, ${withAlpha(color, 0)} 100%)`,
        },
        style,
      ]}
    />
  );
}

/** A memory flying through the tape: a little print (or a slip with its first words), stretched by its speed. */
function MemoryChip({ chip, reel, total, fromX, toX, y, paper, ink }: { chip: Chip; reel: SharedValue<number>; total: number; fromX: number; toX: number; y: number; paper: string; ink: string }) {
  const { typography } = useTheme();
  const a = chip.start / total;
  const b = (chip.start + chip.dur) / total;
  const style = useAnimatedStyle(() => {
    const t = (reel.get() - a) / (b - a);
    const k = Math.max(0, Math.min(1, t));
    const speed = 1 + (1 - chip.dur / FIRST_PASS_MS) * 0.8;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [{ translateX: fromX + (toX - fromX) * k }, { translateY: y - CHIP_W * 0.6 + chip.dy }, { rotate: `${chip.tilt}deg` }, { scaleX: speed }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: CHIP_W, height: CHIP_W * 1.2, padding: 4, paddingBottom: 12, backgroundColor: paper, borderRadius: 2, boxShadow: '0px 2px 4px rgba(0,0,0,0.4)' }, style]}>
      {chip.uri ? (
        <Image source={{ uri: chip.uri }} style={{ flex: 1 }} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <Text numberOfLines={4} style={[typography.hand, { fontSize: 11, lineHeight: 12, color: ink, paddingRight: 0 }]}>
          {chip.words}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
