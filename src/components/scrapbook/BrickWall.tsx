import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { seededRng } from '../../lib/seeded';

const BRICK = '#C9765A';
const BRICK_LIGHT = '#DB8E70';
const BRICK_DARK = '#A95F47';
const MORTAR = '#F1E2C8';
const OUTLINE = '#7E4E3A';
/** Roughly how tall a brick row is; the wall gets as many rows as fit (at least two). */
const ROW_PX = 13;
const PER_ROW = 3;
const GAP = 2;
const CAP = 5;

/**
 * A little hand-drawn garden wall: rows of rounded bricks on cream mortar under a capstone, for
 * the bunny to peek over. Drawn in code like every other scrapbook piece; still, so it costs nothing per frame.
 */
export const BrickWall = memo(function BrickWall({ width, height, style }: { width: number; height: number; style?: StyleProp<ViewStyle> }) {
  const rng = seededRng('brick-wall');
  const rows = Math.max(2, Math.round((height - CAP) / ROW_PX));
  const rowH = (height - CAP - GAP * (rows + 1)) / rows;
  const brickW = (width - GAP * (PER_ROW + 1)) / PER_ROW;
  const bricks: { x: number; y: number; w: number; fill: string }[] = [];
  for (let r = 0; r < rows; r++) {
    const y = CAP + GAP + r * (rowH + GAP);
    // Every other row starts half a brick in, the way walls are laid.
    const shift = r % 2 === 1 ? -brickW / 2 : 0;
    for (let i = 0; i <= PER_ROW; i++) {
      const x0 = GAP + shift + i * (brickW + GAP);
      const x = Math.max(GAP, x0);
      const w = Math.min(width - GAP, x0 + brickW) - x;
      if (w > 2) bricks.push({ x, y, w, fill: rng.pick([BRICK, BRICK, BRICK_LIGHT, BRICK_DARK]) });
    }
  }
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Rect x={0.5} y={CAP / 2} width={width - 1} height={height - CAP / 2 - 0.5} rx={4} fill={MORTAR} stroke={OUTLINE} strokeWidth={1} />
        {bricks.map((b, i) => (
          <Rect key={i} x={b.x} y={b.y} width={b.w} height={rowH} rx={3} fill={b.fill} stroke={OUTLINE} strokeWidth={0.8} strokeOpacity={0.6} />
        ))}
        {/* The capstone along the top, where the bunny rests its paws. */}
        <Rect x={0} y={0} width={width} height={CAP + 1} rx={CAP / 2} fill={BRICK_LIGHT} stroke={OUTLINE} strokeWidth={1} />
        <Path d={`M ${CAP} ${CAP * 0.35} L ${width - CAP} ${CAP * 0.35}`} stroke={MORTAR} strokeWidth={1} strokeOpacity={0.7} strokeLinecap="round" />
      </Svg>
    </View>
  );
});
