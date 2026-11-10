import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { tapHaptic } from '../../lib/haptics';
import { seededRng } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/yearColors';
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
}

const LIGHT = '#FFFFFF';
const DARK = '#000000';
const MAX_WEAR_AGE = 6;
const FADE_PER_YEAR = 0.07;

/** Spine width and height for a year's book (seeded, so each book keeps its size). */
export function spineSize(year: number, maxHeight: number): { width: number; height: number } {
  const rng = seededRng(`spine-${year}`);
  return { width: Math.round(rng.range(52, 62)), height: Math.round(maxHeight * rng.range(0.84, 1)) };
}

/**
 * A year's diary standing on the shelf, spine out, the way books really sit in a cupboard: a rounded
 * cloth spine in the year's color (lit down the middle, shaded at the edges), head and tail bands,
 * a paper label with the year written down it, the number of memories at the foot, and a tiny face
 * that shows its age (wide awake when new, content, then dozing). This year's book has its ribbon
 * bookmark hanging out of the top. Older spines fade and scuff.
 */
export const BookSpine = memo(function BookSpine({ year, count, age, maxHeight, onPress, hidden = false }: Props) {
  const theme = useTheme();
  const { colors, typography, motion, radii } = theme;
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

  // Pressing tips the book forward a touch, as if a finger hooked its top.
  const pressed = useSharedValue(0);
  const tipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pressed.get() * 6 }, { rotate: `${-pressed.get() * 3}deg` }],
  }));

  const bandY = [h * 0.07, h * 0.93];
  const labelTop = h * 0.13;
  const labelH = h * 0.5;
  const faceY = h * 0.74;
  const cx = w / 2;
  const mood = wear === 0 ? 'awake' : wear < 3 ? 'content' : 'dozing';

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
      accessibilityLabel={`${year} diary, ${diaryAgeLabel(age)}, ${count} ${count === 1 ? 'memory' : 'memories'}`}
      hitSlop={{ top: 8, bottom: 8 }}
      style={{ opacity: hidden ? 0 : 1 }}
    >
      <Animated.View ref={ref} collapsable={false} style={[{ width: w, height: h, transformOrigin: 'bottom' }, tipStyle]}>
        <Raster>
          <View style={{ width: w, height: h }}>
            {/* This year's ribbon bookmark, hanging out of the top. */}
            {age <= 0 ? (
              <View
                style={{
                  position: 'absolute',
                  left: w * 0.62,
                  top: -10,
                  width: 7,
                  height: 18,
                  backgroundColor: palette.secondary,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                }}
              />
            ) : null}
            <View
              style={{
                width: w,
                height: h,
                borderRadius: radii.paper * 2,
                backgroundColor: palette.primary,
                borderWidth: 1.2,
                borderColor: withAlpha(palette.ink, 0.6),
                overflow: 'hidden',
              }}
            >
              <Svg width={w} height={h} style={{ position: 'absolute', left: -1.2, top: -1.2 }}>
                <Defs>
                  {/* A rounded spine: light down the middle, falling off to shade at both edges. */}
                  <LinearGradient id={roundId} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={DARK} stopOpacity={0.32} />
                    <Stop offset="0.3" stopColor={LIGHT} stopOpacity={0.18} />
                    <Stop offset="0.5" stopColor={LIGHT} stopOpacity={0.05} />
                    <Stop offset="1" stopColor={DARK} stopOpacity={0.38} />
                  </LinearGradient>
                </Defs>
                {/* Head and tail bands: a raised strip with a gold line. */}
                {bandY.map((y) => (
                  <Rect key={y} x={0} y={y - 4} width={w} height={8} fill={withAlpha(palette.ink, 0.35)} />
                ))}
                {bandY.map((y) => (
                  <Rect key={`g${y}`} x={0} y={y - 0.75} width={w} height={1.5} fill={colors.amber} opacity={0.9} />
                ))}
                {/* Sun-faded cloth, and scuffs on older books. */}
                <Rect x={0} y={0} width={w} height={h} fill={colors.paper} opacity={wear * FADE_PER_YEAR} />
                {scuffs.map((s, i) => (
                  <Path key={i} d={`M ${s.x} ${s.y} l ${s.len} ${s.len * 0.3}`} stroke={LIGHT} strokeWidth={1.2} opacity={0.4} strokeLinecap="round" />
                ))}
                <Rect x={0} y={0} width={w} height={h} fill={`url(#${roundId})`} />

                {/* A tiny face near the foot of the spine. */}
                <Circle cx={cx - 10} cy={faceY + 5} r={3.4} fill={LIGHT} opacity={0.3} />
                <Circle cx={cx + 10} cy={faceY + 5} r={3.4} fill={LIGHT} opacity={0.3} />
                {mood === 'awake' ? (
                  <>
                    <Circle cx={cx - 6} cy={faceY} r={2.4} fill={palette.ink} />
                    <Circle cx={cx + 6} cy={faceY} r={2.4} fill={palette.ink} />
                    <Circle cx={cx - 6.8} cy={faceY - 0.8} r={0.8} fill={LIGHT} />
                    <Circle cx={cx + 5.2} cy={faceY - 0.8} r={0.8} fill={LIGHT} />
                  </>
                ) : (
                  <Path
                    d={
                      mood === 'content'
                        ? `M ${cx - 9} ${faceY + 1} q 3 -4 6 0 M ${cx + 3} ${faceY + 1} q 3 -4 6 0`
                        : `M ${cx - 9} ${faceY - 1} q 3 3.5 6 0 M ${cx + 3} ${faceY - 1} q 3 3.5 6 0`
                    }
                    stroke={palette.ink}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
                <Path
                  d={mood === 'dozing' ? `M ${cx - 2} ${faceY + 6} q 2 1.4 4 0` : `M ${cx - 3} ${faceY + 4.5} q 3 3.2 6 0`}
                  stroke={palette.ink}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>

              {/* Paper label with the year written down the spine (reads bottom to top, like a shelf of books). */}
              <View
                style={{
                  position: 'absolute',
                  top: labelTop,
                  left: w * 0.16,
                  width: w * 0.68,
                  height: labelH,
                  backgroundColor: colors.paperWhite,
                  borderRadius: radii.paper * 2,
                  borderWidth: 1,
                  borderColor: withAlpha(palette.ink, 0.35),
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <View style={{ width: labelH, alignItems: 'center', transform: [{ rotate: '-90deg' }] }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    textBreakStrategy="simple"
                    style={[typography.stampLarge, { color: palette.ink, textAlign: 'center', alignSelf: 'stretch', paddingRight: 0, letterSpacing: 1 }]}
                  >
                    {year}
                  </Text>
                </View>
              </View>

              {/* How many memories it holds, stamped at the foot. */}
              <Text
                numberOfLines={1}
                style={[
                  typography.stamp,
                  { position: 'absolute', left: 0, right: 0, bottom: h * 0.1, color: colors.paperWhite, textAlign: 'center', paddingRight: 0, letterSpacing: 0 },
                ]}
              >
                {count}
              </Text>
            </View>
          </View>
        </Raster>
      </Animated.View>
    </Pressable>
  );
});
