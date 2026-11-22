import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Texture } from './Texture';

/** The cord's colors: its shadow on the page, the cotton, and the nails. */
const CORD_SHADE = 'rgba(25,15,10,0.18)';
const CORD = '#9E825B';
const NAIL = '#79664C';
const NAIL_RIM = '#C6AD80';
/** How far the cord sags in the middle, its thickness, and how many short straight pieces draw the curve. */
const SAG = 12;
const THICK = 2;
const NAIL_R = 3;
const PIECES = 8;

/** The cord's curve (a parabola between the nails) as short straight pieces: centre, length and angle of each. */
function cordPieces(w: number): { cx: number; cy: number; len: number; deg: number }[] {
  const y = (t: number) => 4 * SAG * t * (1 - t);
  return Array.from({ length: PIECES }, (_, i) => {
    const t0 = i / PIECES;
    const t1 = (i + 1) / PIECES;
    const x0 = t0 * w;
    const x1 = t1 * w;
    const dx = x1 - x0;
    const dy = y(t1) - y(t0);
    return { cx: (x0 + x1) / 2, cy: (y(t0) + y(t1)) / 2, len: Math.hypot(dx, dy) + 1, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
  });
}

/**
 * Two small nails and a slack cotton cord; photographs hang below its arc. Drawn with plain views (the curve as a few
 * short straight pieces), not SVG: a page of these drew on the CPU in one long frame.
 */
export const MemoryLine = memo(function MemoryLine({ width, top, progress }: { width: number; top: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const w = width + 8;
  const pieces = useMemo(() => cordPieces(w), [w]);
  const cord = (color: string, dy: number, thick: number) =>
    pieces.map((p, i) => (
      <View key={`${color}-${i}`} style={{ position: 'absolute', left: NAIL_R + 1 + p.cx - p.len / 2, top: 8 + dy + p.cy - thick / 2, width: p.len, height: thick, borderRadius: thick, backgroundColor: color, transform: [{ rotate: `${p.deg}deg` }] }} />
    ));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: top - 20, left: -8, width: width + 16, height: 42 }, style]}>
      {cord(CORD_SHADE, 2, THICK + 1)}
      {cord(CORD, 0, THICK)}
      {[0, w].map((x) => (
        <View key={x} style={{ position: 'absolute', left: x + 1, top: 8 - NAIL_R, width: NAIL_R * 2, height: NAIL_R * 2, borderRadius: NAIL_R, backgroundColor: NAIL, borderWidth: 1, borderColor: NAIL_RIM }} />
      ))}
    </Animated.View>
  );
});

/** Split beechwood with the little steel spring visible across its waist. */
export const MemoryPeg = memo(function MemoryPeg({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: progress.get() }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -17, left: '46%', width: 13, height: 32, zIndex: 100, borderRadius: 2, backgroundColor: '#CDA575', borderWidth: 0.6, borderColor: '#A17C50', transform: [{ rotate: '-5deg' }], boxShadow: '2px 3px 3px rgba(30,20,10,0.25), inset 2px 0px 0px #E3C298' }, style]}>
    <Texture kind="wood" opacity={0.18} radius={2} />
    <View style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 1, backgroundColor: '#9F784E' }} />
    <View style={{ position: 'absolute', left: -1, right: -1, top: 15, height: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#77756A', backgroundColor: '#A5A395' }} />
  </Animated.View>;
});
