import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { Entry } from '../../data';
import { useTheme, withAlpha } from '../../theme';
import { BOW, POSES } from './Buddy';
import { PaperBackground } from './PaperBackground';
import { ScrapObject } from './ScrapObject';

/**
 * Deleting a memory: the bunny's head opens like a lid, its pink brain peeks out, the memory floats
 * up out of it and drops into a little paper shredder with a face, which shakes and lets paper strips
 * fall out of its bottom. Then the bunny closes its head and the whole page fades away. Tap to skip.
 * Reduce motion: a short fade with "all gone".
 *
 * Everything runs off one clock (`t`, in ms) on the UI thread; each piece reads its own window of it.
 */

/** The timeline, in ms. */
const T = {
  fadeIn: [0, 280],
  pop: [120, 520],
  lidOpen: [560, 960],
  rise: [900, 1500],
  travel: [1500, 2100],
  lidClose: [1750, 2100],
  sink: [2150, 2950],
  shake: [2150, 3050],
  strips: 2250,
  stripMs: 950,
  stripGap: 70,
  textTwo: 1500,
  textThree: 3050,
  fadeOut: [3550, 3950],
  total: 3950,
  reduced: 900,
} as const;

/** Where the bunny's head opens: a line through the top of its head (share of the picture's height). */
const CUT = 0.42;
/** The lid's hinge, on the left of the head (share of the picture's width). */
const HINGE_X = 0.24;
const LID_OPEN_DEG = -78;
/** The head's opening at the cut line (share of the picture's width). */
const RIM_LEFT = 0.23;
const RIM_RIGHT = 0.77;

const BRAIN = '#F6A9C1';
const BRAIN_SHADE = '#E07FA0';
const HEAD_INSIDE = '#E9CBA9';
const HEAD_RIM = '#D8B590';
const SLOT = '#2A2118';
const FACE = '#2A2118';
const CHEEK = '#FF9FB5';
const STRIP_COUNT = 7;

interface Props {
  entry: Entry;
  /** Called when the animation ends (or is skipped). */
  onDone: () => void;
}

export function ShredAway({ entry, onDone }: Props) {
  const theme = useTheme();
  const { colors, typography, nav, spacing } = theme;
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const cardH = useSharedValue(W * 0.5);
  const done = useRef(false);

  const total = reduceMotion ? T.reduced : T.total;
  // Once only, whether the clock ran out or the person tapped to skip.
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    t.set(
      withTiming(total, { duration: total, easing: Easing.linear }, (ended) => {
        if (ended) runOnJS(finish)();
      }),
    );
    // Runs once: the clock starts when the shredder appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Layout: the bunny upper left, the shredder lower right, the memory arcs from one to the other.
  const B = Math.min(W * 0.46, 210);
  const bunnyLeft = W * 0.07;
  const bunnyTop = H * 0.2;
  const brainX = bunnyLeft + B * 0.5;
  const brainY = bunnyTop + B * CUT;
  const cardW = W * 0.4;
  const SW = W * 0.56;
  const SH = SW * 0.62;
  const shredX = W * 0.6;
  const slotY = H * 0.56;
  const bodyTop = slotY - SH * 0.12;
  const bodyBottom = bodyTop + SH;
  const stripW = (SW * 0.62) / STRIP_COUNT - 3;
  const stripL = H * 0.11;

  const root = useAnimatedStyle(() => {
    const v = t.get();
    if (reduceMotion) return { opacity: interpolate(v, [0, 200, T.reduced - 250, T.reduced], [0, 1, 1, 0], Extrapolation.CLAMP) };
    return { opacity: interpolate(v, [T.fadeIn[0], T.fadeIn[1], T.fadeOut[0], T.fadeOut[1]], [0, 1, 1, 0], Extrapolation.CLAMP) };
  });

  const bunny = useAnimatedStyle(() => {
    const v = t.get();
    const pop = interpolate(v, [T.pop[0], T.pop[1] - 120, T.pop[1]], [0.3, 1.08, 1], Extrapolation.CLAMP);
    // A little nod while the memory leaves, and a happy hop at the end.
    const nod = interpolate(v, [T.rise[0], T.rise[0] + 200, T.rise[1]], [0, -6, 0], Extrapolation.CLAMP);
    const hop = interpolate(v, [T.textThree, T.textThree + 160, T.textThree + 420], [0, -14, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY: nod + hop }, { scale: pop }] };
  });

  const lid = useAnimatedStyle(() => {
    const v = t.get();
    const open = interpolate(v, [T.lidOpen[0], T.lidOpen[1], T.lidClose[0], T.lidClose[1]], [0, 1, 1, 0], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${Easing.out(Easing.back(1.6))(open) * LID_OPEN_DEG}deg` }] };
  });

  const brain = useAnimatedStyle(() => {
    const v = t.get();
    const up = interpolate(v, [T.lidOpen[0] + 150, T.lidOpen[1] + 100, T.lidClose[0], T.lidClose[1]], [0, 1, 1, 0], Extrapolation.CLAMP);
    // It wiggles while the memory is pulled out of it.
    const wiggle = v > T.rise[0] && v < T.rise[1] ? Math.sin(v / 40) * 2 : 0;
    // Hidden while the head is shut, so no pink peeks over the bunny's forehead.
    return { opacity: Math.min(1, up * 4), transform: [{ translateY: -up * B * 0.07 }, { rotate: `${wiggle}deg` }] };
  });

  // The opening's rim and the lid's underside only show while the head is open (no seam when shut).
  const inside = useAnimatedStyle(() => {
    const v = t.get();
    const open = interpolate(v, [T.lidOpen[0], T.lidOpen[0] + 120, T.lidClose[1] - 120, T.lidClose[1]], [0, 1, 1, 0], Extrapolation.CLAMP);
    return { opacity: open };
  });

  const card = useAnimatedStyle(() => {
    const v = t.get();
    const h = cardH.get();
    const peakX = W * 0.62;
    const peakY = H * 0.16 + h * 0.4;
    const overSlotY = slotY - h * 0.75 * 0.5;
    let cx = brainX;
    let cy = brainY;
    let scale = 0.1;
    let rot = 0;
    let opacity = 0;
    if (v >= T.rise[0] && v < T.travel[0]) {
      const p = (v - T.rise[0]) / (T.rise[1] - T.rise[0]);
      const up = Easing.out(Easing.cubic)(p);
      cx = brainX + (peakX - brainX) * Easing.inOut(Easing.quad)(p);
      cy = brainY + (peakY - brainY) * up;
      scale = 0.1 + 0.65 * up;
      rot = -14 * p;
      opacity = Math.min(1, p * 4);
    } else if (v >= T.travel[0] && v < T.sink[0]) {
      const p = Math.min(1, (v - T.travel[0]) / (T.travel[1] - T.travel[0]));
      cx = peakX + (shredX - peakX) * p;
      cy = peakY + (overSlotY - peakY) * Easing.in(Easing.quad)(p);
      scale = 0.75;
      rot = -14 + 14 * Easing.out(Easing.quad)(p);
      opacity = 1;
    } else if (v >= T.sink[0]) {
      const p = Math.min(1, (v - T.sink[0]) / (T.sink[1] - T.sink[0]));
      cx = shredX + Math.sin(v / 22) * 1.5;
      cy = overSlotY + h * 0.8 * Easing.in(Easing.quad)(p);
      scale = 0.75;
      opacity = 1;
    }
    return {
      opacity,
      transform: [{ translateX: cx - cardW / 2 }, { translateY: cy - h / 2 }, { rotate: `${rot}deg` }, { scale }],
    };
  });

  const shredder = useAnimatedStyle(() => {
    const v = t.get();
    const on = v > T.shake[0] && v < T.shake[1];
    const appear = interpolate(v, [T.travel[0] - 300, T.travel[0]], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: appear,
      transform: [
        { translateX: on ? Math.sin(v / 18) * 2.2 : 0 },
        { translateY: (1 - appear) * 30 + (on ? Math.abs(Math.sin(v / 27)) * -2 : 0) },
        { scaleY: on ? 1 + Math.sin(v / 35) * 0.015 : 1 },
      ],
    };
  });

  const lineOne = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [T.pop[0], T.pop[1], T.textTwo - 150, T.textTwo], [0, 1, 1, 0], Extrapolation.CLAMP) }));
  const lineTwo = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [T.textTwo, T.textTwo + 150, T.textThree - 150, T.textThree], [0, 1, 1, 0], Extrapolation.CLAMP) }));
  const lineThree = useAnimatedStyle(() => ({ opacity: reduceMotion ? 1 : interpolate(t.get(), [T.textThree, T.textThree + 150], [0, 1], Extrapolation.CLAMP) }));

  const textTop = H * 0.08;
  const said = [typography.headline, { color: colors.onDesk, textAlign: 'center' as const, position: 'absolute' as const, left: spacing.gutter, right: spacing.gutter, top: textTop }];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={finish}>
      <Animated.View style={[StyleSheet.absoluteFill, root]}>
        <PaperBackground variant="dots" desk />
        <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={finish} style={StyleSheet.absoluteFill}>
          {reduceMotion ? (
            <Animated.Text style={[said, { top: H * 0.42 }, lineThree]}>all gone ✿ </Animated.Text>
          ) : (
            <>
              <Animated.Text style={[said, lineOne]}>Bun is forgetting it… </Animated.Text>
              <Animated.Text style={[said, lineTwo]}>shred, shred, shred ✂ </Animated.Text>
              <Animated.Text style={[said, lineThree]}>all gone ✿ </Animated.Text>

              {/* Paper strips slide out of the shredder's bottom (drawn behind it). */}
              {Array.from({ length: STRIP_COUNT }, (_, i) => (
                <Strip
                  key={i}
                  index={i}
                  t={t}
                  left={shredX - SW * 0.31 + i * (stripW + 3)}
                  top={bodyBottom - stripL - SH * 0.08}
                  width={stripW}
                  length={stripL}
                  paper={colors.paperWhite}
                  line={withAlpha(colors.ink, 0.35)}
                />
              ))}

              <Animated.View style={[{ position: 'absolute', left: shredX - SW / 2, top: bodyTop, width: SW, height: SH }, shredder]}>
                <Shredder width={SW} height={SH} body={nav.tape} lid={nav.tape2} rim={colors.paperWhite} />
              </Animated.View>

              {/* The memory, clipped at the slot so it disappears into the shredder. */}
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: slotY + 1, overflow: 'hidden' }}>
                <Animated.View
                  onLayout={(e) => cardH.set(e.nativeEvent.layout.height)}
                  style={[{ position: 'absolute', left: 0, top: 0, width: cardW }, card]}
                >
                  <ScrapObject entry={entry} width={cardW} numberOfLines={3} />
                </Animated.View>
              </View>

              <Animated.View style={[{ position: 'absolute', left: bunnyLeft, top: bunnyTop, width: B, height: B, transformOrigin: 'bottom' }, bunny]}>
                <OpenHead size={B} accent={nav.tape} lid={lid} brain={brain} inside={inside} />
              </Animated.View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/** The bunny cut in two at its forehead: body, the inside of its head with the brain, and the top as a hinged lid. */
type AnimStyle = ReturnType<typeof useAnimatedStyle>;

function OpenHead({ size: s, accent, lid, brain, inside }: { size: number; accent: string; lid: AnimStyle; brain: AnimStyle; inside: AnimStyle }) {
  const cutY = s * CUT;
  const rimL = s * RIM_LEFT;
  const rimW = s * (RIM_RIGHT - RIM_LEFT);
  const picture = (
    <>
      <Image source={POSES.happy} style={{ width: s, height: s }} contentFit="fill" transition={0} cachePolicy="memory" />
      <Image source={BOW} tintColor={accent} style={[StyleSheet.absoluteFill, { width: s, height: s }]} contentFit="fill" transition={0} cachePolicy="memory" />
    </>
  );
  return (
    <View style={{ width: s, height: s }}>
      {/* Body: everything below the cut. */}
      <View style={{ position: 'absolute', left: 0, top: cutY, width: s, height: s - cutY, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: -cutY }}>{picture}</View>
      </View>
      {/* The brain, rising out of the opening. */}
      <Animated.View style={[{ position: 'absolute', left: rimL + rimW * 0.08, top: cutY - rimW * 0.42, width: rimW * 0.84, height: rimW * 0.5 }, brain]}>
        <Brain width={rimW * 0.84} height={rimW * 0.5} />
      </Animated.View>
      {/* The opening's rim, in front of the brain's lower edge so it sits inside the head. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: cutY - s * 0.03, width: s, height: s * 0.12 }, inside]}>
        <Svg width={s} height={s * 0.12}>
          <Path d={`M ${rimL} ${s * 0.03} Q ${s / 2} ${s * 0.1} ${rimL + rimW} ${s * 0.03}`} fill="none" stroke={HEAD_RIM} strokeWidth={s * 0.012} strokeLinecap="round" />
        </Svg>
      </Animated.View>
      {/* The top of the head, as a lid hinged on the left. */}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: s, height: cutY, overflow: 'hidden', transformOrigin: [s * HINGE_X, cutY, 0] }, lid]}>
        {picture}
        {/* The underside of the lid shows as it opens. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, inside]}>
          <Svg width={s} height={cutY}>
            <Ellipse cx={s / 2} cy={cutY} rx={rimW / 2} ry={s * 0.035} fill={HEAD_INSIDE} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** A soft pink cartoon brain: a lumpy cloud with a middle fold and a few squiggles. */
function Brain({ width: w, height: h }: { width: number; height: number }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 100 60">
      <Path
        d="M8 52 C0 44 2 30 12 27 C10 15 24 7 34 13 C38 3 56 2 61 11 C70 4 86 9 86 21 C97 23 100 38 92 46 C93 56 82 60 72 57 L22 57 C14 59 8 57 8 52 Z"
        fill={BRAIN}
        stroke={BRAIN_SHADE}
        strokeWidth={2.2}
      />
      <G fill="none" stroke={BRAIN_SHADE} strokeWidth={2} strokeLinecap="round">
        <Path d="M50 12 C46 22 54 30 49 40 C46 47 52 52 50 56" />
        <Path d="M22 30 C28 26 32 34 38 30" />
        <Path d="M20 44 C26 40 30 47 37 43" />
        <Path d="M62 26 C68 22 72 30 78 26" />
        <Path d="M64 42 C70 38 75 45 82 41" />
      </G>
      <Ellipse cx={30} cy={20} rx={7} ry={3.5} fill="#FFFFFF" opacity={0.45} />
    </Svg>
  );
}

/** A little paper shredder with a face: a lid with the slot, a round body, a zigzag of teeth at the bottom. */
function Shredder({ width: w, height: h, body, lid, rim }: { width: number; height: number; body: string; lid: string; rim: string }) {
  const lidH = h * 0.24;
  const teeth = Array.from({ length: 12 }, (_, i) => {
    const x0 = w * 0.12 + ((w * 0.76) / 12) * i;
    const x1 = x0 + (w * 0.76) / 24;
    const x2 = x0 + (w * 0.76) / 12;
    return `L ${x1} ${h * 0.98} L ${x2} ${h * 0.92}`;
  }).join(' ');
  return (
    <Svg width={w} height={h}>
      {/* Body */}
      <Path d={`M ${w * 0.08} ${lidH} L ${w * 0.92} ${lidH} L ${w * 0.88} ${h * 0.92} ${teeth} L ${w * 0.12} ${h * 0.92} Z`} fill={body} stroke={withAlpha(FACE, 0.35)} strokeWidth={1.5} strokeLinejoin="round" />
      {/* Lid with the slot */}
      <Rect x={w * 0.02} y={0} width={w * 0.96} height={lidH} rx={lidH * 0.4} fill={lid} stroke={withAlpha(FACE, 0.35)} strokeWidth={1.5} />
      <Rect x={w * 0.1} y={h * 0.1 - h * 0.025} width={w * 0.8} height={h * 0.05} rx={h * 0.025} fill={SLOT} />
      {/* Stitch line, like the bar */}
      <Rect x={w * 0.13} y={lidH + h * 0.06} width={w * 0.74} height={h * 0.56} rx={h * 0.08} fill="none" stroke={withAlpha(rim, 0.6)} strokeWidth={1.4} strokeDasharray="5 4" />
      {/* Face */}
      <Circle cx={w * 0.38} cy={h * 0.5} r={h * 0.045} fill={FACE} />
      <Circle cx={w * 0.62} cy={h * 0.5} r={h * 0.045} fill={FACE} />
      <Circle cx={w * 0.39} cy={h * 0.485} r={h * 0.015} fill="#FFFFFF" />
      <Circle cx={w * 0.63} cy={h * 0.485} r={h * 0.015} fill="#FFFFFF" />
      <Ellipse cx={w * 0.29} cy={h * 0.6} rx={h * 0.06} ry={h * 0.035} fill={CHEEK} opacity={0.75} />
      <Ellipse cx={w * 0.71} cy={h * 0.6} rx={h * 0.06} ry={h * 0.035} fill={CHEEK} opacity={0.75} />
      <Path d={`M ${w * 0.45} ${h * 0.6} Q ${w * 0.5} ${h * 0.68} ${w * 0.55} ${h * 0.6}`} fill="none" stroke={FACE} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** One shredded strip: slides out from behind the shredder, falls a little, curls and fades. */
function Strip({ index, t, left, top, width, length, paper, line }: { index: number; t: SharedValue<number>; left: number; top: number; width: number; length: number; paper: string; line: string }) {
  const start = T.strips + index * T.stripGap;
  const style = useAnimatedStyle(() => {
    const p = interpolate(t.get(), [start, start + T.stripMs], [0, 1], Extrapolation.CLAMP);
    const out = Easing.out(Easing.quad)(p);
    return {
      opacity: interpolate(p, [0, 0.05, 0.75, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: out * length * 1.7 },
        { rotate: `${Math.sin(p * 6 + index) * 7 * p}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width, height: length, backgroundColor: paper, borderRadius: 2, overflow: 'hidden' }, style]}>
      {[0.2, 0.45, 0.7].map((y) => (
        <View key={y} style={{ position: 'absolute', left: 1, right: 1, top: length * y, height: 1.5, backgroundColor: line }} />
      ))}
    </Animated.View>
  );
}
