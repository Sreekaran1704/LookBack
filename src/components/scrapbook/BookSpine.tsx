import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { tapHaptic } from '../../lib/haptics';
import { seededRng } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { mixHex, withAlpha } from '../../theme/yearColors';
import { diaryAgeLabel, type DiaryFrame } from './AlbumStack';
import { Raster } from './Raster';
import { useSvgId } from './shared';

interface Props {
  year: number;
  count: number;
  /** Whole years since this diary's year (0 = this year's). Older spines look more worn. */
  age: number;
  /** Tallest a spine gets; each book is a little shorter or taller than the next (seeded by year). */
  maxHeight: number;
  /** Tapped: gets where the spine is on screen, so the book can be pulled out from exactly there. */
  onPress?: (frame: DiaryFrame) => void;
  /** Hidden while the book is off the shelf (a gap is left where it stood). */
  hidden?: boolean;
  /** How full the volume is (0–1): this year's fills up as the year goes on, past ones are full. */
  fill?: number;
}

const LIGHT = '#FFFFFF';
const DARK = '#000000';
/** Gold leaf on the spine: the same bright gilt by day and night, since the spine itself is always dark leather. */
const SPINE_GILT = '#D4B26A';
/** The room above the spine for things poking out of the top. */
const STICK = 14;
/** What pokes out of a full volume: a page, a photo, a tape, a letter. */
const SLIP_PAPER = '#F1E8D4';
const SLIP_PHOTO = '#FBFAF6';
const SLIP_TAPE = '#1C1C1E';
const SLIP_ENVELOPE = '#F6F4EE';
const AIRMAIL_RED = '#C8302B';
const AIRMAIL_BLUE = '#1F4EA0';
const REPAIR_TAPE = 'rgba(240, 232, 210, 0.7)';
const DOODLE_INK = 'rgba(255, 245, 225, 0.55)';
const DOODLES = [
  'M0 -6 L1.8 -1.8 L6 -1.8 L2.6 1 L3.8 5.4 L0 2.8 L-3.8 5.4 L-2.6 1 L-6 -1.8 L-1.8 -1.8 Z',
  'M0 4 C-6 -1 -4 -6 0 -2.5 C4 -6 6 -1 0 4 Z',
  'M0 0 C2 -2 4 0 2 2 C0 4 -4 2 -3 -2 C-2 -6 4 -6 5 -1',
  'M-6 0 L-3 -3 L0 0 L3 -3 L6 0',
  'M-5 -5 L5 5 M5 -5 L-5 5',
];
const MAX_WEAR_AGE = 6;
const FADE_PER_YEAR = 0.07;

/** Spine width and height for a year's book (seeded, so each book keeps its size). */
export function spineSize(year: number, maxHeight: number): { width: number; height: number } {
  const rng = seededRng(`spine-${year}`);
  return { width: Math.round(rng.range(52, 62)), height: Math.round(maxHeight * rng.range(0.84, 1)) };
}

/** How deep the year's color goes into the leather: a stain, not a paint. */
const LEATHER_DEPTH = 0.62;

/**
 * A year's volume standing on the shelf, spine out: leather in a deep shade of the year's color, rounded (lit down
 * the middle, shaded at the edges), raised bands tooled in gilt, the year in gilt reading up the spine,
 * and the number of pages at the foot. This year's volume has its ribbon hanging out of the top. As a volume fills it
 * gets lived in: pages, photos, tapes and letters poke out of the top, its edge tears and is mended with tape, and pale
 * pen doodles appear. Older volumes are rubbed paler and scuffed.
 */
export const BookSpine = memo(function BookSpine({ year, count, age, maxHeight, onPress, hidden = false, fill = 1 }: Props) {
  const theme = useTheme();
  const { colors, typography, motion } = theme;
  const palette = theme.year(year);
  const roundId = useSvgId('round');
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { width: w, height: h } = spineSize(year, maxHeight);
  const wear = Math.min(Math.max(age, 0), MAX_WEAR_AGE);
  const rng = seededRng(`spine-wear-${year}`);
  const scuffs = Array.from({ length: wear >= 2 ? wear + 1 : 0 }, () => ({
    x: rng.range(6, w - 10),
    y: rng.range(10, h - 12),
    len: rng.range(4, 10),
  }));
  const leather = mixHex(palette.primary, DARK, LEATHER_DEPTH);
  const gilt = SPINE_GILT;
  // A volume gets lived in as it fills: things poking out of the top, a torn edge mended with tape, doodles in pen.
  const full = Math.max(0, Math.min(1, fill));
  const life = seededRng(`spine-life-${year}`);
  const slips = Array.from({ length: Math.round(full * 4) }, (_, i) => ({
    kind: (['paper', 'photo', 'tape', 'envelope'] as const)[(i + Math.floor(life.range(0, 4))) % 4] ?? 'paper',
    x: life.range(2, w - 22),
    lift: life.range(4, STICK - 1),
    tilt: life.range(-14, 14),
  }));
  const doodles = Array.from({ length: Math.round(full * 3) }, (_, i) => ({ d: DOODLES[(i + year) % DOODLES.length] ?? '', x: life.range(10, w - 10), y: life.range(h * 0.3, h * 0.75), r: life.range(-30, 30) }));
  const torn = full > 0.45;
  const mended = full > 0.6;

  // Pressing tips the book forward a touch, as if a finger hooked its top.
  const pressed = useSharedValue(0);
  const tipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pressed.get() * 6 }, { rotate: `${-pressed.get() * 3}deg` }],
  }));

  // Raised bands across the spine (the cords of the binding), each tooled with two gilt lines.
  const bands = [h * 0.08, h * 0.2, h * 0.8, h * 0.92];
  const titleTop = h * 0.26;
  const titleH = h * 0.48;

  return (
    <Pressable
      onPressIn={() => pressed.set(withSpring(1, motion.press))}
      onPressOut={() => pressed.set(withSpring(0, motion.press))}
      onPress={() => {
        tapHaptic();
        ref.current?.measureInWindow((x: number, y: number, mw: number, mh: number) => onPress?.({ x, y, width: mw, height: mh }));
      }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${year} volume, ${diaryAgeLabel(age)}, ${count} ${count === 1 ? 'page' : 'pages'}`}
      hitSlop={{ top: 8, bottom: 8 }}
      style={{ opacity: hidden ? 0 : 1 }}
    >
      <Animated.View ref={ref} collapsable={false} style={[{ width: w, height: h, transformOrigin: 'bottom' }, tipStyle]}>
        <Raster>
          <View style={{ width: w, height: h }}>
            {/* Pages, photos, tapes and letters poking out of the top as the volume fills. */}
            {slips.map((sl, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: sl.x,
                  top: STICK - sl.lift,
                  width: sl.kind === 'tape' ? 22 : sl.kind === 'photo' ? 16 : 20,
                  height: 18,
                  backgroundColor: sl.kind === 'paper' ? SLIP_PAPER : sl.kind === 'photo' ? SLIP_PHOTO : sl.kind === 'tape' ? SLIP_TAPE : SLIP_ENVELOPE,
                  borderRadius: sl.kind === 'tape' ? 2 : 1,
                  transform: [{ rotate: `${sl.tilt}deg` }],
                  boxShadow: '0px 1px 2px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                }}
              >
                {sl.kind === 'photo' ? <View style={{ margin: 2, height: 9, backgroundColor: palette.primary, opacity: 0.8 }} /> : null}
                {sl.kind === 'tape' ? <View style={{ marginTop: 2, marginHorizontal: 3, height: 5, backgroundColor: SLIP_PAPER }} /> : null}
                {sl.kind === 'envelope' ? <View style={{ height: 3, backgroundImage: `repeating-linear-gradient(90deg, ${AIRMAIL_RED} 0px, ${AIRMAIL_RED} 4px, ${AIRMAIL_BLUE} 4px, ${AIRMAIL_BLUE} 8px)` }} /> : null}
                {sl.kind === 'paper' ? <View style={{ marginTop: 5, marginHorizontal: 3, height: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} /> : null}
              </View>
            ))}
            {/* This year's ribbon, hanging out of the top. */}
            {age <= 0 ? <View style={{ position: 'absolute', left: w * 0.62, top: STICK - 10, width: 7, height: 18, backgroundColor: colors.wax, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} /> : null}
            <View style={{ position: 'absolute', top: STICK, width: w, height: h - STICK, borderRadius: 4, backgroundColor: leather, borderWidth: 1, borderColor: withAlpha(DARK, 0.6), overflow: 'hidden' }}>
              <Svg width={w} height={h} style={{ position: 'absolute', left: -1, top: -1 }}>
                <Defs>
                  {/* A rounded spine: light down the middle, falling off to shade at both edges. */}
                  <LinearGradient id={roundId} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={DARK} stopOpacity={0.45} />
                    <Stop offset="0.32" stopColor={LIGHT} stopOpacity={0.14} />
                    <Stop offset="0.52" stopColor={LIGHT} stopOpacity={0.04} />
                    <Stop offset="1" stopColor={DARK} stopOpacity={0.5} />
                  </LinearGradient>
                </Defs>
                {/* Rubbed paler with age, and scuffed. */}
                <Rect x={0} y={0} width={w} height={h} fill={LIGHT} opacity={wear * FADE_PER_YEAR * 0.5} />
                {scuffs.map((sc, i) => (
                  <Path key={i} d={`M ${sc.x} ${sc.y} l ${sc.len} ${sc.len * 0.3}`} stroke={LIGHT} strokeWidth={1} opacity={0.25} strokeLinecap="round" />
                ))}
                {bands.map((y) => (
                  <Rect key={y} x={0} y={y - 3.5} width={w} height={7} rx={2} fill={withAlpha(LIGHT, 0.08)} stroke={withAlpha(DARK, 0.35)} strokeWidth={0.8} />
                ))}
                {bands.map((y) => (
                  <Rect key={`g${y}`} x={0} y={y - 4.5} width={w} height={1} fill={gilt} opacity={0.85} />
                ))}
                {bands.map((y) => (
                  <Rect key={`h${y}`} x={0} y={y + 3.5} width={w} height={1} fill={gilt} opacity={0.85} />
                ))}
                {/* Doodles in pale pen, as the year goes on. */}
                {doodles.map((dd, i) => (
                  <Path key={`d${i}`} d={dd.d} transform={`translate(${dd.x} ${dd.y}) rotate(${dd.r})`} stroke={DOODLE_INK} strokeWidth={1.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {/* A torn edge: a ragged bite out of the spine's edge. */}
                {torn ? <Path d={`M ${w} ${h * 0.38} l -6 4 l 4 3 l -7 5 l 9 4 Z`} fill={DARK} opacity={0.55} /> : null}
                <Rect x={0} y={0} width={w} height={h} fill={`url(#${roundId})`} />
              </Svg>
              {/* …mended with a strip of tape. */}
              {mended ? <View style={{ position: 'absolute', right: -4, top: h * 0.36, width: 22, height: 14, backgroundColor: REPAIR_TAPE, transform: [{ rotate: '-12deg' }] }} /> : null}

              {/* The year in gilt, reading up the spine. */}
              <View style={{ position: 'absolute', top: titleTop, left: 0, width: w, height: titleH, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: titleH, alignItems: 'center', transform: [{ rotate: '-90deg' }] }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                    textBreakStrategy="simple"
                    style={[typography.stampLarge, { color: gilt, textAlign: 'center', alignSelf: 'stretch', paddingRight: 0, letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 }]}
                  >
                    {year}
                  </Text>
                </View>
              </View>

              {/* How many pages it holds, between the bands at the foot. */}
              <Text numberOfLines={1} style={[typography.stamp, { position: 'absolute', left: 0, right: 0, top: (h - STICK) * 0.83, color: gilt, textAlign: 'center', paddingRight: 0, letterSpacing: 0.5 }]}>
                {count}
              </Text>
            </View>
          </View>
        </Raster>
      </Animated.View>
    </Pressable>
  );
});
