import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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
import { tapHaptic } from '../lib/haptics';
import { seededRng, type StickerKind } from '../lib/seeded';
import { useTheme } from '../theme';
import { AlbumStack, type DiaryFrame } from './scrapbook/AlbumStack';
import { BookSpine } from './scrapbook/BookSpine';
import { Raster } from './scrapbook/Raster';
import { LiteShadows } from './ThemeProvider';
import { Sticker } from './scrapbook/Sticker';

export interface Flight {
  year: number;
  count: number;
  age: number;
  /** Width the diary's cover is drawn at before scaling. */
  width: number;
  /** The shelf's tallest spine (BookSpine's maxHeight), so the flying spine matches the one on the shelf. */
  spineMax: number;
  /** Where the spine stands on the shelf (window coordinates). */
  frame: DiaryFrame;
}

interface BookFlightApi {
  /** Pulls a diary off the shelf and opens it into its year page. */
  fly: (flight: Flight) => void;
  /** The year whose diary is off the shelf (its spot shows a gap), or null. */
  flying: number | null;
  /** The year page calls this once it has drawn, so the page covering it can fade away. */
  ready: (year: number) => void;
}

const BookFlightContext = createContext<BookFlightApi>({ fly: () => undefined, flying: null, ready: () => undefined });

export function useBookFlight(): BookFlightApi {
  return useContext(BookFlightContext);
}

/** Hosts the flying diary above every screen. Wrap the navigator with it. */
export function BookFlightProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [flight, setFlight] = useState<Flight | null>(null);
  const readyListenerRef = useRef<((year: number) => void) | null>(null);
  const fly = useCallback(
    (next: Flight) => {
      if (reduceMotion) {
        router.push(`/year/${next.year}`);
        return;
      }
      setFlight((current) => current ?? next);
    },
    [reduceMotion],
  );
  const ready = useCallback((year: number) => readyListenerRef.current?.(year), []);
  const value = useMemo(() => ({ fly, flying: flight?.year ?? null, ready }), [fly, flight, ready]);
  return (
    <BookFlightContext.Provider value={value}>
      {children}
      {flight ? <FlyingDiary flight={flight} readyListenerRef={readyListenerRef} onDone={() => setFlight(null)} /> : null}
    </BookFlightContext.Provider>
  );
}

const SPARKLES = 12;
const SPARKLE_KINDS: readonly StickerKind[] = ['star', 'heart', 'star', 'sun'];
/** Where the diary is opened: this share of the screen width, centred a little above the middle. */
const TARGET_WIDTH = 0.62;
const TARGET_Y = 0.44;
/** Height of the little arc it floats along on the way. */
const ARC_PX = 70;
const PERSPECTIVE = 1100;

/**
 * The magic, in one unbroken move:
 * 1. the spine slides up out of its row on the shelf and the room softens to paper;
 * 2. the book floats to the middle in a little arc, growing, and turns to show its cover;
 * 3. the cover swings open on its spine — a warm glow, stars and hearts burst out;
 * 4. meanwhile the year's page has been opened underneath, hidden by the paper, so its loading never
 *    shows; once it has drawn, the open book swells towards you and dissolves as the paper fades,
 *    revealing the page — and only then do its memories stack on (the year screen waits for us).
 */
function FlyingDiary({
  flight,
  readyListenerRef,
  onDone,
}: {
  flight: Flight;
  readyListenerRef: React.RefObject<((year: number) => void) | null>;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { colors, motion, sizes } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const palette = theme.year(flight.year);
  const pull = useSharedValue(0);
  const travel = useSharedValue(0);
  const turn = useSharedValue(0);
  const open = useSharedValue(0);
  const burst = useSharedValue(0);
  /** 0..1: the open book swells and dissolves, the paper fades, the year page shows through. */
  const dive = useSharedValue(0);
  const diving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { frame } = flight;
  const cx = W / 2;
  const cy = H * TARGET_Y;
  // The opened diary's size on screen, and its cover's (the cover sits top-left on the page edges).
  const scale = (W * TARGET_WIDTH) / flight.width;
  const edge = sizes.albumPageEdge * 3;
  const coverW = (flight.width - edge) * scale;
  const coverH = (sizes.albumHeight - edge) * scale;
  const coverCx = cx - (edge / 2) * scale;
  const coverCy = cy - (edge / 2) * scale;
  // The spine flies to where the cover will be and grows to its height.
  const spineScale = coverH / frame.height;
  const dx = coverCx - (frame.x + frame.width / 2);
  const dy = coverCy - (frame.y + frame.height / 2);

  const startDive = useCallback(() => {
    if (diving.current) return;
    diving.current = true;
    dive.set(
      withTiming(1, { duration: motion.bookFlight.diveMs, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)();
      }),
    );
  }, [dive, motion.bookFlight.diveMs, onDone]);
  const sparkle = useCallback(() => tapHaptic(), []);

  useEffect(() => {
    const m = motion.bookFlight;
    pull.set(withTiming(1, { duration: m.pullMs, easing: Easing.out(Easing.cubic) }));
    const travelAt = m.pullMs * 0.6;
    travel.set(withDelay(travelAt, withSpring(1, { duration: m.travelMs, dampingRatio: 0.85 })));
    const turnAt = travelAt + m.travelMs * 0.55;
    turn.set(withDelay(turnAt, withTiming(1, { duration: m.turnMs, easing: Easing.inOut(Easing.cubic) })));
    const openAt = turnAt + m.turnMs;
    open.set(withDelay(openAt, withTiming(1, { duration: m.openMs, easing: Easing.inOut(Easing.cubic) })));
    burst.set(
      withDelay(
        openAt + m.openMs * 0.4,
        withTiming(1, { duration: m.burstMs, easing: Easing.out(Easing.quad) }, (done) => {
          if (done) runOnJS(sparkle)();
        }),
      ),
    );
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    // The book reaches the middle and the paper is opaque: open the year page underneath now, so it
    // loads while the book turns and opens.
    let pageDrawn = false;
    let bookOpen = false;
    const maybeDive = () => {
      if (pageDrawn && bookOpen) startDive();
    };
    readyListenerRef.current = (year) => {
      if (year !== flight.year) return;
      pageDrawn = true;
      maybeDive();
    };
    at(turnAt, () => router.push(`/year/${flight.year}`));
    at(openAt + m.openMs + m.settleMs, () => {
      bookOpen = true;
      maybeDive();
    });
    // Never get stuck if the page's "drawn" signal doesn't come.
    at(openAt + m.openMs + m.settleMs + m.readyFallbackMs, startDive);
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      readyListenerRef.current = null;
    };
  }, [pull, travel, turn, open, burst, motion.bookFlight, sparkle, startDive, readyListenerRef, flight.year]);

  // The room behind softens to paper as the book leaves the shelf; fully opaque by the time the year
  // page is opened underneath, so its loading is never seen.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pull.get() * 0.4 + travel.get() * 0.6) * (1 - dive.get()) }));

  const spineStyle = useAnimatedStyle(() => {
    const t = Math.min(1, travel.get());
    const p = pull.get();
    const r = Math.min(1, turn.get() * 2);
    return {
      opacity: turn.get() < 0.5 ? 1 : 0,
      transform: [
        { translateX: dx * t },
        // Slides up out of its row first, then floats in an arc to the middle.
        { translateY: -p * 22 * (1 - t) + dy * t - Math.sin(t * Math.PI) * ARC_PX },
        { perspective: PERSPECTIVE },
        // Turns to bring its cover round.
        { rotateY: `${r * 90}deg` },
        { rotate: `${Math.sin(t * Math.PI) * -5}deg` },
        { scale: (1 + p * 0.06) * (1 + (spineScale - 1) * t) },
      ],
    };
  });
  const coverStyle = useAnimatedStyle(() => {
    const r = Math.max(0, turn.get() * 2 - 1);
    return {
      opacity: turn.get() >= 0.5 ? 1 - dive.get() : 0,
      // Diving in: the open book swells towards you as it dissolves.
      transform: [{ perspective: PERSPECTIVE }, { rotateY: `${(r - 1) * 90}deg` }, { scale: scale * (1 + dive.get() * 0.9) }],
    };
  });

  const glowSize = coverW * 1.6;
  const glowStyle = useAnimatedStyle(() => ({
    opacity: open.get() * 0.9 * (1 - dive.get()),
    transform: [{ scale: 0.6 + open.get() * 0.55 + dive.get() * 0.8 }],
  }));

  const sparkles = useMemo(() => {
    const rng = seededRng(`sparkle-${flight.year}`);
    return Array.from({ length: SPARKLES }, (_, i) => ({
      angle: (i / SPARKLES) * Math.PI * 2 + rng.range(-0.2, 0.2),
      distance: coverW * rng.range(0.6, 1),
      size: rng.range(18, 34),
      spin: rng.range(-90, 90),
      kind: SPARKLE_KINDS[i % SPARKLE_KINDS.length] ?? 'star',
      color: i % 3 === 0 ? colors.amber : i % 3 === 1 ? palette.primary : palette.secondary,
    }));
  }, [flight.year, coverW, colors.amber, palette.primary, palette.secondary]);

  return (
    <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.desk }, backdropStyle]} />
      {/* Warm glow: a soft radial gradient drawn once into a texture, then only scaled and faded. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: coverCx - glowSize / 2, top: coverCy - glowSize / 2, width: glowSize, height: glowSize }, glowStyle]}
      >
        <View renderToHardwareTextureAndroid shouldRasterizeIOS style={{ width: glowSize, height: glowSize }}>
          <Svg width={glowSize} height={glowSize}>
            <Defs>
              <RadialGradient id="bookglow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.amber} stopOpacity={0.6} />
                <Stop offset="0.45" stopColor={colors.amber} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.amber} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#bookglow)" />
          </Svg>
        </View>
      </Animated.View>

      {/* Everything that moves is drawn without blurred shadows, so each frame stays cheap. */}
      <LiteShadows>
      {/* The book, first as its spine... */}
      <Animated.View style={[{ position: 'absolute', left: frame.x, top: frame.y }, spineStyle]}>
        <BookSpine year={flight.year} count={flight.count} age={flight.age} maxHeight={flight.spineMax} />
      </Animated.View>
      {/* ...then turned round to its cover, which swings open. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: cx - flight.width / 2, top: cy - sizes.albumHeight / 2 }}>
        <Animated.View style={coverStyle}>
          <AlbumStack
            year={flight.year}
            count={flight.count}
            width={flight.width}
            coverUri={null}
            age={flight.age}
            open={open}
            raster={false}
            showLabel={false}
          />
        </Animated.View>
      </View>

      {sparkles.map((s, i) => (
        <SparkleBit key={i} bit={s} cx={coverCx} cy={coverCy} burst={burst} dive={dive} />
      ))}
      </LiteShadows>

    </View>
  );
}

interface Bit {
  angle: number;
  distance: number;
  size: number;
  spin: number;
  kind: StickerKind;
  color: string;
}

function SparkleBit({ bit, cx, cy, burst, dive }: { bit: Bit; cx: number; cy: number; burst: SharedValue<number>; dive: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const b = burst.get();
    return {
      // Pops out, twinkles, then fades as it drifts on.
      opacity: (b > 0.001 ? Math.min(1, b * 4) * (1 - b * 0.7) : 0) * (1 - dive.get()),
      transform: [
        { translateX: Math.cos(bit.angle) * bit.distance * b },
        { translateY: Math.sin(bit.angle) * bit.distance * b - b * 20 },
        { rotate: `${bit.spin * b}deg` },
        { scale: Math.sin(Math.min(1, b * 1.6) * Math.PI * 0.5) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - bit.size / 2, top: cy - bit.size / 2 }, style]}>
      <Raster>
        <Sticker kind={bit.kind} size={bit.size} color={bit.color} color2={bit.color} />
      </Raster>
    </Animated.View>
  );
}
