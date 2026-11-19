import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';
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
import { useTheme, withAlpha } from '../theme';
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
/** One more sparkle is built every so often before the burst, so no frame builds them all. */
const SPARK_EVERY_MS = 45;
const SPARKLE_KINDS: readonly StickerKind[] = ['star', 'heart', 'star', 'sun'];
/** The cover's width on screen when it opens (the open spread is twice this), centred a little above the middle. */
const COVER_SHARE = 0.42;
const TARGET_Y = 0.44;
/** Height of the little arc it floats along on the way. */
const ARC_PX = 70;
const PERSPECTIVE = 1400;
/** Light falling off a face as it turns away from you. */
const SHADE = 0.32;
const PAGE_LINES = 7;

/**
 * Opening a diary, as one solid book:
 * 1. it tips forward and slides up out of its row on the shelf, and the room softens to paper;
 * 2. it floats to the middle in a little arc, growing, a soft shadow gathering under it;
 * 3. it turns like a real box: the spine swings away as the cover swings round on the same edge, each
 *    face darkening as it turns from the light;
 * 4. the cover swings open on its spine and lies flat, showing its lined inside; two pages flutter
 *    over after it; the book slides across to centre the open spread; a warm glow, stars and hearts;
 * 5. meanwhile the year's page has been opened underneath, hidden by the paper, so its loading never
 *    shows; once it has drawn, the book zooms into its right-hand page until that page is the year's
 *    page, and the book fades into it. Its memories stack on after that (the year screen waits for us).
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
  const { colors, motion, sizes, typography, radii } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const palette = theme.year(flight.year);
  const pull = useSharedValue(0);
  const travel = useSharedValue(0);
  const turn = useSharedValue(0);
  const open = useSharedValue(0);
  const page0 = useSharedValue(0);
  const page1 = useSharedValue(0);
  const burst = useSharedValue(0);
  /** 0..1: the book zooms into its right page, which becomes the year page. */
  const dive = useSharedValue(0);
  const diving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * The pieces are built a few at a time, each a little before it is needed, instead of all in the first frame
   * (which took 150 ms and made the spine stutter as it left the shelf): 0 the spine; 1 the cover; 2 the pages
   * under it, its lining and the glow; 3 the fluttering pages. The sparkles come one at a time (all ten in one
   * frame cost ~80 ms as the cover opened).
   */
  const [stage, setStage] = useState(0);
  const [sparks, setSparks] = useState(0);

  const { frame } = flight;
  const edge = sizes.albumPageEdge;
  // The cover's own size (AlbumStack draws it at the top left of `flight.width` × albumHeight).
  const coverW = flight.width - edge * 3;
  const coverH = sizes.albumHeight - edge * 3;
  const sc = (W * COVER_SHARE) / coverW;
  const coverWs = coverW * sc;
  const coverHs = coverH * sc;
  const cx = W / 2;
  const cy = H * TARGET_Y;
  // The spine edge (hinge) of the closed book, centred; once open the spread is centred instead.
  const hingeX = cx - coverWs / 2;
  const spread = coverWs / 2;
  // The spine flies from the shelf so its right edge lands on the hinge, growing to the cover's height.
  const spineScale = coverHs / frame.height;
  const fromX = frame.x + frame.width;
  const fromY = frame.y + frame.height / 2;
  // Zooming into the right page until it fills the screen.
  const pageCx = cx + coverWs / 2;
  const zoom = Math.max(W / coverWs, H / coverHs) * 1.08;
  const pageColor = theme.dark ? colors.paper : palette.tint;

  const startDive = useCallback(() => {
    if (diving.current) return;
    diving.current = true;
    dive.set(
      withTiming(1, { duration: motion.bookFlight.diveMs, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)();
      }),
    );
  }, [dive, motion.bookFlight.diveMs, onDone]);
  const thud = useCallback(() => tapHaptic(), []);

  useEffect(() => {
    const m = motion.bookFlight;
    pull.set(withTiming(1, { duration: m.pullMs, easing: Easing.out(Easing.cubic) }));
    const travelAt = m.pullMs * 0.6;
    travel.set(withDelay(travelAt, withSpring(1, { duration: m.travelMs, dampingRatio: 0.9 })));
    const turnAt = travelAt + m.travelMs * 0.7;
    turn.set(withDelay(turnAt, withTiming(1, { duration: m.turnMs, easing: Easing.inOut(Easing.cubic) })));
    const openAt = turnAt + m.turnMs;
    // A real cover: slow to lift, quicker over the top, easing down flat.
    open.set(
      withDelay(
        openAt,
        withTiming(1, { duration: m.openMs, easing: Easing.bezier(0.42, 0, 0.25, 1) }, (done) => {
          if (done) runOnJS(thud)();
        }),
      ),
    );
    const pagesAt = openAt + m.openMs * 0.45;
    page0.set(withDelay(pagesAt, withTiming(1, { duration: m.pageMs, easing: Easing.bezier(0.4, 0, 0.3, 1) })));
    page1.set(withDelay(pagesAt + m.pageGapMs, withTiming(1, { duration: m.pageMs, easing: Easing.bezier(0.4, 0, 0.3, 1) })));
    burst.set(withDelay(openAt + m.openMs * 0.55, withTiming(1, { duration: m.burstMs, easing: Easing.out(Easing.quad) })));
    const openedAt = Math.max(openAt + m.openMs, pagesAt + m.pageGapMs + m.pageMs) + m.settleMs;

    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    // The book is in the middle and the paper is opaque: open the year page underneath now, so it
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
    // Spread out so no single frame builds much; each stage is in place well before it shows.
    at(m.pullMs * 0.5, () => setStage(1));
    at(travelAt + m.travelMs * 0.35, () => setStage(2));
    at(turnAt + m.turnMs * 0.5, () => setStage(3));
    for (let i = 0; i < SPARKLES; i++) at(openAt - m.pageGapMs + i * SPARK_EVERY_MS, () => setSparks(i + 1));
    at(turnAt, () => router.push(`/year/${flight.year}`));
    at(openedAt, () => {
      bookOpen = true;
      maybeDive();
    });
    // Never get stuck if the page's "drawn" signal doesn't come.
    at(openedAt + m.readyFallbackMs, startDive);
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      readyListenerRef.current = null;
    };
  }, [pull, travel, turn, open, page0, page1, burst, motion.bookFlight, thud, startDive, readyListenerRef, flight.year]);

  // The room behind softens to paper as the book leaves the shelf; fully opaque by the time the year
  // page is opened underneath, so its loading is never seen. It clears as the book becomes the page.
  const fadeOut = (d: number) => {
    'worklet';
    return Math.min(1, Math.max(0, (d - 0.55) / 0.45));
  };
  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pull.get() * 0.4 + travel.get() * 0.6) * (1 - fadeOut(dive.get())) }));

  /** The hinge's offset from where it ends up, the book's lean, and its scale relative to the end (all from the flight). */
  const flightOf = () => {
    'worklet';
    const t = Math.min(1, travel.get());
    const p = pull.get();
    const arc = Math.sin(t * Math.PI);
    return {
      x: (fromX - hingeX) * (1 - t),
      y: (fromY - cy) * (1 - t) - p * 26 * (1 - t) - arc * ARC_PX,
      lean: -arc * 5 + p * (1 - t) * -4,
      grow: (1 + p * 0.06 * (1 - t)) * (1 + (spineScale - 1) * t),
    };
  };

  // The spine: its right edge is the hinge; it turns away as the cover comes round.
  const spineStyle = useAnimatedStyle(() => {
    const f = flightOf();
    const r = turn.get();
    return {
      opacity: r < 0.999 ? 1 : 0,
      transform: [
        { translateX: hingeX - fromX + f.x },
        { translateY: cy - fromY + f.y },
        { perspective: PERSPECTIVE },
        { rotateZ: `${f.lean}deg` },
        { rotateY: `${-r * 90}deg` },
        { scale: f.grow },
      ],
    };
  });
  const spineShade = useAnimatedStyle(() => ({ opacity: turn.get() * SHADE * 1.6 }));

  // The cover: comes round on the same edge, then swings open over the top and lies flat on the left.
  const coverStyle = useAnimatedStyle(() => {
    const f = flightOf();
    const r = turn.get();
    const a = open.get() * 180;
    const angle = (1 - r) * 90 - a;
    return {
      opacity: r > 0.001 && angle > -90 ? 1 : 0,
      transform: [
        { translateX: f.x + open.get() * spread },
        { translateY: f.y },
        { perspective: PERSPECTIVE },
        { rotateZ: `${f.lean}deg` },
        { rotateY: `${angle}deg` },
        { scale: (sc * f.grow) / spineScale },
      ],
    };
  });
  const coverShade = useAnimatedStyle(() => {
    const angle = (1 - turn.get()) * 90 - open.get() * 180;
    return { opacity: (Math.abs(angle) / 90) * SHADE };
  });
  // The inside of the cover, seen once it has gone over the top.
  const insideStyle = useAnimatedStyle(() => {
    const a = open.get() * 180;
    return {
      opacity: a > 90 ? 1 : 0,
      transform: [{ translateX: open.get() * spread }, { perspective: PERSPECTIVE }, { rotateY: `${180 - a}deg` }, { scale: sc }],
    };
  });
  const insideShade = useAnimatedStyle(() => ({ opacity: ((180 - open.get() * 180) / 90) * SHADE }));
  // The pages under the cover, there once the book has turned round.
  const blockStyle = useAnimatedStyle(() => ({
    opacity: turn.get() > 0.96 ? 1 : 0,
    transform: [{ translateX: open.get() * spread }, { scale: sc }],
  }));
  // Words on the pages are drawn small; they fade as the book zooms in, so they never loom huge.
  const wordsStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, dive.get() * 2.5) }));

  // The whole book (and its glow) zooms into the right page, then fades into the real page.
  const sceneStyle = useAnimatedStyle(() => {
    const d = dive.get();
    return {
      opacity: 1 - fadeOut(d),
      transform: [{ translateX: (cx - pageCx) * d }, { translateY: (H / 2 - cy) * d }, { scale: 1 + (zoom - 1) * d }],
    };
  });

  const glowSize = coverWs * 2.4;
  const glowStyle = useAnimatedStyle(() => ({
    opacity: open.get() * 0.85,
    transform: [{ scale: 0.6 + open.get() * 0.55 }],
  }));
  // A soft shadow on the paper under the book, gathering as it comes to rest, widening as it opens.
  const shadowW = coverWs * 1.3;
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, travel.get()) * 0.55,
    transform: [{ translateX: open.get() * spread }, { scaleX: 1 + open.get() * 0.85 }],
  }));

  const sparkles = useMemo(() => {
    const rng = seededRng(`sparkle-${flight.year}`);
    return Array.from({ length: SPARKLES }, (_, i) => ({
      angle: (i / SPARKLES) * Math.PI * 2 + rng.range(-0.2, 0.2),
      distance: coverWs * rng.range(0.8, 1.3),
      size: rng.range(18, 34),
      spin: rng.range(-90, 90),
      kind: SPARKLE_KINDS[i % SPARKLE_KINDS.length] ?? 'star',
      color: i % 3 === 0 ? colors.amber : i % 3 === 1 ? palette.primary : palette.secondary,
    }));
  }, [flight.year, coverWs, colors.amber, palette.primary, palette.secondary]);

  const pageTop = cy - coverH / 2;
  const ruled = (
    <Svg pointerEvents="none" width={coverW} height={coverH} style={StyleSheet.absoluteFill}>
      {Array.from({ length: PAGE_LINES }, (_, i) => {
        const y = (coverH / (PAGE_LINES + 1)) * (i + 1);
        return <Line key={i} x1={8} x2={coverW - 8} y1={y} y2={y} stroke={colors.ruleLine} strokeWidth={0.8} />;
      })}
    </Svg>
  );
  // The spine's right edge and the cover's left edge are the same hinge (see `hinge`).
  const spineHinge = hinge('left', frame.x + frame.width, frame.y, frame.width, frame.height, frame.height / 2);
  const coverHinge = hinge('right', hingeX, pageTop, flight.width, sizes.albumHeight, coverH / 2);
  const insideHinge = hinge('left', hingeX, pageTop, coverW, coverH, coverH / 2);
  const sheet = { width: coverW, height: coverH, borderRadius: radii.album, backgroundColor: colors.paperWhite, borderWidth: 0.6, borderColor: withAlpha(palette.ink, 0.25), overflow: 'hidden' as const };

  return (
    <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.desk }, backdropStyle]} />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: [pageCx, cy, 0] }, sceneStyle]}>
        {/* Warm glow: a native radial gradient (GPU; as an SVG this size it cost 22 ms to paint), only scaled and faded. */}
        {stage >= 2 ? (
          <Animated.View
            style={[
              { position: 'absolute', left: cx - glowSize / 2, top: cy - glowSize / 2, width: glowSize, height: glowSize, borderRadius: glowSize / 2 },
              { backgroundImage: `radial-gradient(circle closest-side, ${withAlpha(colors.amber, 0.55)} 0%, ${withAlpha(colors.amber, 0.22)} 45%, ${withAlpha(colors.amber, 0)} 100%)` },
              glowStyle,
            ]}
          />
        ) : null}

        {/* The book's shadow on the paper (a native gradient). */}
        <Animated.View
          style={[
            { position: 'absolute', left: cx - shadowW / 2, top: cy + coverHs / 2 - coverHs * 0.06, width: shadowW, height: coverHs * 0.16, borderRadius: shadowW / 2 },
            { backgroundImage: `radial-gradient(closest-side, ${withAlpha(palette.ink, 0.5)} 0%, ${withAlpha(palette.ink, 0)} 100%)` },
            shadowStyle,
          ]}
        />

        {/* Everything that moves is drawn without blurred shadows, so each frame stays cheap. */}
        <LiteShadows>
          {/* The pages under the cover: edges peeking out, and the first page (the year page in small). */}
          {stage >= 2 ? (
          <Animated.View style={[{ position: 'absolute', left: hingeX, top: pageTop, width: flight.width, height: sizes.albumHeight, transformOrigin: [0, coverH / 2, 0] }, blockStyle]}>
            {[3, 2, 1].map((layer) => (
              <View key={layer} style={[sheet, { position: 'absolute', left: edge * layer, top: edge * layer, backgroundColor: layer % 2 ? colors.paperWhite : colors.paper }]} />
            ))}
            <View style={[sheet, { position: 'absolute', left: 0, top: 0, backgroundColor: pageColor, alignItems: 'center', justifyContent: 'center' }]}>
              <Animated.View style={[{ alignItems: 'center', alignSelf: 'stretch' }, wordsStyle]}>
                <Text style={[typography.albumYear, { color: palette.primary, textAlign: 'center', alignSelf: 'stretch' }]}>{flight.year}</Text>
                <Text style={[typography.handSmall, { color: colors.inkMuted, textAlign: 'center', alignSelf: 'stretch' }]}>
                  {flight.count} {flight.count === 1 ? 'memory' : 'memories'}
                </Text>
              </Animated.View>
              {/* The gutter: pages curve down into the spine. */}
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: coverW * 0.1, backgroundColor: palette.ink, opacity: 0.08 }} />
            </View>
          </Animated.View>
          ) : null}

          {/* The inside of the cover, lying open on the left: a lining in the year's color with a paper pocket. */}
          {stage >= 2 ? (
          <Animated.View style={[insideHinge.box, insideStyle]}>
            <View style={[insideHinge.face, sheet, { backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <View style={{ width: coverW * 0.78, height: coverH * 0.82, borderRadius: radii.album, backgroundColor: palette.tint, opacity: 0.9 }} />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }, insideShade]} />
            </View>
          </Animated.View>
          ) : null}

          {/* Two pages flutter over after the cover. */}
          {stage >= 3 ? (
          <>
          <FlutterPage progress={page0} turn={turn} hingeX={hingeX} top={pageTop} coverW={coverW} coverH={coverH} sc={sc} spread={spread} open={open} sheet={sheet} ruled={ruled} ink={colors.ink} />
          <FlutterPage
            progress={page1}
            turn={turn}
            hingeX={hingeX}
            top={pageTop}
            coverW={coverW}
            coverH={coverH}
            sc={sc}
            spread={spread}
            open={open}
            sheet={sheet}
            ruled={ruled}
            ink={colors.ink}
            back={
              <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, wordsStyle]}>
                <Text style={[typography.hand, { color: colors.ink, textAlign: 'center', alignSelf: 'stretch' }]}>{`hello again, ${flight.year} `}</Text>
                <Text style={[typography.handSmall, { color: palette.primary, textAlign: 'center', alignSelf: 'stretch' }]}>✿ ♥ ✿</Text>
              </Animated.View>
            }
          />
          </>
          ) : null}

          {/* The cover, which comes round on the spine's edge and swings open. */}
          {stage >= 1 ? (
          <Animated.View style={[coverHinge.box, coverStyle]}>
            <View style={coverHinge.face}>
              <AlbumStack year={flight.year} count={flight.count} width={flight.width} coverUri={null} age={flight.age} raster={false} showLabel={false} coverOnly />
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: coverW, height: coverH, borderRadius: radii.album, backgroundColor: colors.ink }, coverShade]} />
            </View>
          </Animated.View>
          ) : null}

          {/* The spine, as it left the shelf. */}
          <Animated.View style={[spineHinge.box, spineStyle]}>
            <View style={spineHinge.face}>
              <BookSpine year={flight.year} count={flight.count} age={flight.age} maxHeight={flight.spineMax} />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, borderRadius: radii.album }, spineShade]} />
            </View>
          </Animated.View>

          {sparkles.slice(0, sparks).map((s, i) => (
            <SparkleBit key={i} bit={s} cx={cx} cy={cy} burst={burst} />
          ))}
        </LiteShadows>
      </Animated.View>
    </View>
  );
}

/**
 * Where a face that turns on a hinge is drawn. Android turns a view in 3D around the view's centre and
 * only shifts it flat to honour `transformOrigin`, so under perspective a face turning on its edge
 * drifts off the hinge, each face by a different amount (the narrow spine and the wide cover came apart).
 * So every hinged face sits in a box twice its width whose centre IS the hinge: the faces stay joined.
 * `side` is which side of the hinge the face lies on; `hingeX` is the hinge's x on the page.
 */
function hinge(side: 'left' | 'right', hingeX: number, top: number, faceW: number, height: number, originY: number) {
  return {
    box: { position: 'absolute' as const, left: hingeX - faceW, top, width: faceW * 2, height, transformOrigin: [faceW, originY, 0] as [number, number, number] },
    face: { position: 'absolute' as const, left: side === 'right' ? faceW : 0, top: 0, width: faceW, height },
  };
}

/** One page turning over from the right to the left, its front and back, darkening as it turns. */
function FlutterPage({
  progress,
  turn,
  hingeX,
  top,
  coverW,
  coverH,
  sc,
  spread,
  open,
  sheet,
  ruled,
  ink,
  back,
}: {
  progress: SharedValue<number>;
  /** The book has turned round: the pages lie on the right, over the title page, until they turn. */
  turn: SharedValue<number>;
  hingeX: number;
  top: number;
  coverW: number;
  coverH: number;
  sc: number;
  spread: number;
  open: SharedValue<number>;
  sheet: object;
  ruled: ReactNode;
  ink: string;
  back?: ReactNode;
}) {
  const frontStyle = useAnimatedStyle(() => {
    const q = progress.get() * 180;
    return {
      opacity: turn.get() > 0.96 && q < 90 ? 1 : 0,
      transform: [{ translateX: open.get() * spread }, { perspective: PERSPECTIVE }, { rotateY: `${-q}deg` }, { scale: sc }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const q = progress.get() * 180;
    return {
      opacity: q >= 90 ? 1 : 0,
      transform: [{ translateX: open.get() * spread }, { perspective: PERSPECTIVE }, { rotateY: `${180 - q}deg` }, { scale: sc }],
    };
  });
  const frontShade = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.get() * 2) * SHADE }));
  const backShade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - progress.get()) * 2 * SHADE }));
  const front = hinge('right', hingeX, top, coverW, coverH, coverH / 2);
  const rear = hinge('left', hingeX, top, coverW, coverH, coverH / 2);
  return (
    <>
      <Animated.View style={[front.box, frontStyle]}>
        <View style={[front.face, sheet]}>
          {ruled}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink }, frontShade]} />
        </View>
      </Animated.View>
      <Animated.View style={[rear.box, backStyle]}>
        <View style={[rear.face, sheet]}>
          {ruled}
          {back}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink }, backShade]} />
        </View>
      </Animated.View>
    </>
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

function SparkleBit({ bit, cx, cy, burst }: { bit: Bit; cx: number; cy: number; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const b = burst.get();
    return {
      // Pops out, twinkles, then fades as it drifts on.
      opacity: b > 0.001 ? Math.min(1, b * 4) * (1 - b * 0.7) : 0,
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
