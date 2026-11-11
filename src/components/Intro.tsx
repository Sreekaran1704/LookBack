import * as SplashScreen from 'expo-splash-screen';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Entry } from '../data';
import { tapHaptic } from '../lib/haptics';
import { seededRng } from '../lib/seeded';
import { paletteByName, useTheme } from '../theme';
import { Buddy, type BuddyMood } from './scrapbook/Buddy';
import { Doodle } from './scrapbook/Doodle';
import { ScrapObject } from './scrapbook/ScrapObject';
import { WashiTape } from './scrapbook/WashiTape';
import { LiteShadows } from './ThemeProvider';

interface Props {
  /** Recent memories to rain down; placeholder notes fill in when there are few. */
  entries: Entry[];
  today: string;
  onDone: () => void;
}

/** Same width as the splash image (app.json → expo-splash-screen → imageWidth), so the hand-off is seamless. */
const SPLASH_IMAGE_W = 180;
/** The splash bunny's bow (scripts/make-icons.mjs uses coral); the intro bunny wears the same one. */
const SPLASH_BOW = paletteByName('coral')?.primary;
/** Pieces across one row of the heap, and how much of a piece's width each row adds to the heap's height. */
const COLUMNS = 3;
const ROW_PITCH = 0.74;
const CARD_RATIO = 0.47;
/** How many land right on the bunny, in front of it. */
const ON_HEAD = 2;
const MAX_PIECES = 22;
const PLACEHOLDERS = [
  'a small good thing',
  '"keep going"',
  'sunny walk',
  'tea with mum',
  'first snow',
  'new notebook',
  'late-night pizza',
  'beach day',
  'road trip',
  '"be here now"',
  'picnic',
  'rainy window',
];

interface Piece {
  entry: Entry;
  width: number;
  inFront: boolean;
  startX: number;
  endX: number;
  endY: number;
  startRot: number;
  endRot: number;
  delay: number;
}

/**
 * The startup animation. The native splash shows the bunny; this takes over in the same spot, the
 * bunny hops down to the bottom of the screen, then memories rain down and pile up from the floor to
 * the top of the screen, burying everything but the bunny (two land right on its head; it squashes at
 * landings). The name appears on a taped label, and the whole sheet lifts away to the home screen,
 * which has been rendering underneath the whole time. Tap to skip. With "reduce motion" it is a fade.
 */
export function Intro({ entries, today, onDone }: Props) {
  const theme = useTheme();
  const { colors, typography, spacing, motion, sizes, radii } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [mood, setMood] = useState<BuddyMood>('happy');
  const [bump, setBump] = useState(0);
  const [titleW, setTitleW] = useState(0);
  /** Starts the show once the bunny is on screen; the memories are only mounted then, so the splash hides at once. */
  const [armed, setArmed] = useState(false);
  const exit = useSharedValue(0);
  const title = useSharedValue(0);
  /** 0 = in the middle (where the splash left it), 1 = sitting at the bottom of the screen. */
  const descend = useSharedValue(0);
  const leaving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const bunnyW = SPLASH_IMAGE_W * (1000 / 1024);
  const bunnyX = (W - bunnyW) / 2;
  const bunnyY0 = (H - bunnyW) / 2;
  // Where it settles: at the foot of the screen, just above the gesture bar.
  const bunnyY = H - insets.bottom - spacing.xl - bunnyW;
  const cardW = W * CARD_RATIO;

  // The heap: rows of pieces from the floor to the top of the screen, every slot jittered and tilted
  // (seeded, so it is the same every launch). Bottom rows land first, so it builds upwards.
  const pieces = useMemo((): Piece[] => {
    const pitch = cardW * ROW_PITCH;
    const rows = Math.ceil(H / pitch) + 1;
    const behind = Math.min(MAX_PIECES - ON_HEAD, rows * COLUMNS);
    const total = behind + ON_HEAD;
    const real = entries.slice(0, total);
    const all = [
      ...real,
      ...Array.from({ length: total - real.length }, (_, i): Entry => ({
        id: `intro-${i}`,
        localDate: today,
        text: PLACEHOLDERS[i % PLACEHOLDERS.length] ?? '',
        photoPath: null,
        createdAt: today,
        updatedAt: today,
        objectType: null,
        tapePattern: null,
        sticker: null,
        stickerColor: null,
        tapeColor: null,
      })),
    ];
    const stagger = motion.introRainMs / total;
    return all.map((entry, i) => {
      const rng = seededRng(`intro-${entry.id}-${i}`);
      const inFront = i >= behind;
      const width = inFront ? cardW * 0.6 : cardW * rng.range(0.85, 1.1);
      let endX: number;
      let endY: number;
      if (inFront) {
        // On its head, the second on top of the first.
        endX = W / 2 + (i === behind ? -0.12 : 0.14) * bunnyW;
        endY = bunnyY - width * (0.5 + (i - behind) * 0.28);
      } else {
        const row = Math.floor(i / COLUMNS);
        const col = row % 2 === 0 ? i % COLUMNS : COLUMNS - 1 - (i % COLUMNS);
        endX = ((col + 0.5) / COLUMNS) * W + rng.range(-0.18, 0.18) * cardW;
        // Row 0 rests on the floor; each row above sits a little higher.
        endY = H - insets.bottom - width * 1.05 - row * pitch + rng.range(-0.12, 0.12) * width;
      }
      return {
        entry,
        width,
        inFront,
        startX: endX + rng.range(-0.6, 0.6) * cardW,
        endX,
        endY,
        startRot: rng.range(-60, 60),
        endRot: rng.range(-16, 16),
        delay: motion.introFirstDropMs + i * stagger,
      };
    });
  }, [entries, today, W, H, insets.bottom, bunnyW, bunnyY, cardW, motion.introFirstDropMs, motion.introRainMs]);

  const finish = useCallback(() => onDone(), [onDone]);
  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    timers.current.forEach(clearTimeout);
    exit.set(
      withTiming(1, { duration: motion.introExitMs, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
  }, [exit, finish, motion.introExitMs]);

  // Hide the native splash once the same bunny, in the same place, is actually on screen.
  const onShown = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    setArmed(true);
  }, []);

  // Safety net: never leave the splash up if the picture's callback doesn't come.
  useEffect(() => {
    const timer = setTimeout(onShown, motion.introSplashFallbackMs);
    return () => clearTimeout(timer);
  }, [onShown, motion.introSplashFallbackMs]);

  useEffect(() => {
    if (!armed) return;
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    if (reduceMotion) {
      descend.set(1);
      title.set(withTiming(1, { duration: motion.imageFadeMs }));
      at(motion.introReducedHoldMs, leave);
    } else {
      // Hop down to the bottom of the screen and land with a bounce.
      descend.set(withDelay(motion.introDescendDelayMs, withSpring(1, motion.drop)));
      at(motion.introDescendDelayMs + motion.drop.duration * 0.7, () => setBump((b) => b + 1));
      // It squashes as things land on and around it (every few, so it doesn't jitter).
      pieces.forEach((p, i) => {
        if (p.inFront || i % 4 === 0) at(p.delay + motion.introFallMs * 0.8, () => setBump((b) => b + 1));
      });
      const landed = (pieces[pieces.length - 1]?.delay ?? 0) + motion.introFallMs;
      at(landed, () => {
        setMood('cheer');
        title.set(withSpring(1, motion.pop));
      });
      at(landed + motion.introHoldMs, leave);
    }
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, [armed, pieces, reduceMotion, leave, title, descend, motion]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ scale: 1 + exit.get() * 0.08 }],
  }));
  const bunnyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (bunnyY - bunnyY0) * descend.get() }] }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, title.get() * 1.4),
    transform: [{ translateY: (1 - title.get()) * -spacing.xl }, { rotate: '-3deg' }, { scale: 0.85 + title.get() * 0.15 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.desk }, sheetStyle]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          tapHaptic();
          leave();
        }}
        accessibilityRole="button"
        accessibilityLabel="Skip the intro"
      >
        {/* A whole screen of moving paper: flat shadows only, so every frame stays cheap. */}
        <LiteShadows>
          {reduceMotion || !armed ? null : pieces.filter((p) => !p.inFront).map((p) => <FallingPiece key={p.entry.id} piece={p} H={H} exit={exit} />)}
        </LiteShadows>
        <Animated.View style={[{ position: 'absolute', left: bunnyX, top: bunnyY0 }, bunnyStyle]}>
          <Buddy mood={mood} size={bunnyW} bump={bump} entrance={false} accent={SPLASH_BOW} onShown={onShown} />
        </Animated.View>
        <LiteShadows>
          {reduceMotion || !armed ? null : pieces.filter((p) => p.inFront).map((p) => <FallingPiece key={p.entry.id} piece={p} H={H} exit={exit} />)}
        </LiteShadows>

        {/* The name on a taped paper label, laid on top of the heap. */}
        <Animated.View style={[styles.title, { top: H * 0.3 }, titleStyle]}>
          <View
            style={{
              backgroundColor: colors.paperWhite,
              borderRadius: radii.paper * 2,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm,
              boxShadow: theme.shadow(undefined, 1.6),
            }}
          >
            <View>
              {titleW > 0 ? (
                <Doodle
                  kind="highlight"
                  width={titleW + spacing.md}
                  height={typography.title.lineHeight ?? 0}
                  color={colors.amber}
                  seed={8}
                  style={{ position: 'absolute', left: -spacing.sm / 2, top: spacing.xs }}
                />
              ) : null}
              <Text
                onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
                numberOfLines={1}
                textBreakStrategy="simple"
                style={[typography.title, { color: colors.ink }]}
              >
                LookBack{' '}
              </Text>
            </View>
            <WashiTape
              width={sizes.tapeHeight * 4}
              color={SPLASH_BOW ?? colors.amber}
              color2={colors.paperWhite}
              pattern="stripes"
              angle={6}
              style={{ position: 'absolute', top: -sizes.tapeHeight / 2, alignSelf: 'center' }}
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** One memory tumbling down from above the screen and landing with a little bounce. */
const FallingPiece = memo(function FallingPiece({ piece, H, exit }: { piece: Piece; H: number; exit: SharedValue<number> }) {
  const { motion, colors, opacity, radii } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    // An underdamped spring overshoots a touch past the landing spot: the bounce.
    // Every piece is built in one go while the bunny still sits in the middle (nothing is moving yet,
    // so that work can't cost a visible frame); after that the rain is pure motion on the UI thread.
    t.set(withDelay(piece.delay, withSpring(1, { duration: motion.introFallMs, dampingRatio: 0.62 })));
  }, [t, piece.delay, motion.introFallMs]);
  const fromY = -piece.width * 1.6 - H * 0.1;
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: p > 0.001 ? 1 : 0,
      transform: [
        { translateX: piece.startX + (piece.endX - piece.startX) * p - piece.width / 2 },
        // Leaving: the heap drifts down a little as the sheet lifts away.
        { translateY: fromY + (piece.endY - fromY) * p + exit.get() * 30 },
        { rotate: `${piece.startRot + (piece.endRot - piece.startRot) * p}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.piece, { width: piece.width }, style]}>
      {/* A flat offset shape stands in for the soft paper shadow. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.shadowBase, opacity: opacity.pileShadow, borderRadius: radii.paper * 2, transform: [{ translateX: 3 }, { translateY: 5 }] },
        ]}
      />
      <ScrapObject entry={piece.entry} width={piece.width} numberOfLines={3} raster={false} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  piece: { position: 'absolute', left: 0, top: 0 },
});
