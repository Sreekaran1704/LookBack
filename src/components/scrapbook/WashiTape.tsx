import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Pattern, Polyline, Rect } from 'react-native-svg';
import type { TapePattern } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/yearColors';
import { deg, useSvgId } from './shared';

interface Props {
  width: number;
  height?: number;
  color: string;
  color2: string;
  pattern: TapePattern;
  angle?: number;
  style?: StyleProp<ViewStyle>;
}

const NOTCH = 3.5;
const TILE = 12;

/** Torn (zig-zag) tape ends. */
function tapeOutline(w: number, h: number): string {
  const steps = Math.max(3, Math.round(h / (NOTCH * 2)));
  const step = h / steps;
  let d = `M ${NOTCH} 0 L ${w - NOTCH} 0`;
  for (let i = 1; i <= steps; i++) d += ` L ${i % 2 ? w : w - NOTCH} ${i * step}`;
  d += ` L ${NOTCH} ${h}`;
  for (let i = steps - 1; i >= 0; i--) d += ` L ${i % 2 ? 0 : NOTCH} ${i * step}`;
  return `${d} Z`;
}

function PatternTile({ pattern, color2 }: { pattern: TapePattern; color2: string }) {
  switch (pattern) {
    case 'stripes':
      return <Rect x={0} y={0} width={TILE / 2} height={TILE} fill={color2} />;
    case 'dots':
      return <Circle cx={TILE / 2} cy={TILE / 2} r={2.2} fill={color2} />;
    case 'grid':
      return (
        <G stroke={color2} strokeWidth={1.2}>
          <Line x1={0} y1={0} x2={TILE} y2={0} />
          <Line x1={0} y1={0} x2={0} y2={TILE} />
        </G>
      );
    case 'zigzag':
      return <Polyline points={`0,8 3,4 6,8 9,4 12,8`} stroke={color2} strokeWidth={1.6} fill="none" />;
    case 'floral':
      return (
        <G fill={color2}>
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle
              key={a}
              cx={TILE / 2 + Math.cos((a * Math.PI) / 180) * 2.6}
              cy={TILE / 2 + Math.sin((a * Math.PI) / 180) * 2.6}
              r={1.7}
            />
          ))}
          <Circle cx={TILE / 2} cy={TILE / 2} r={1.3} fill="#FFFFFF" />
        </G>
      );
  }
}

/** Translucent patterned washi tape with torn ends. Glows faintly in midnight mode. */
export const WashiTape = memo(function WashiTape({ width, height, color, color2, pattern, angle = 0, style }: Props) {
  const theme = useTheme();
  const h = height ?? theme.sizes.tapeHeight;
  const clipId = useSvgId('tapeclip');
  const patId = useSvgId('tapepat');
  const outline = tapeOutline(width, h);
  const rotate = pattern === 'stripes' ? 45 : 0;

  // In a crowd (theme.lite) dozens of tapes are on screen at once: a plain strip looks the same at that size.
  if (theme.lite) {
    return (
      <View
        pointerEvents="none"
        style={[{ width, height: h, backgroundColor: color, opacity: theme.opacity.tape, transform: [{ rotate: deg(angle) }] }, style]}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        { width, height: h, transform: [{ rotate: deg(angle) }], opacity: theme.opacity.tape },
        style,
      ]}
    >
      <Svg width={width} height={h}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={outline} />
          </ClipPath>
          <Pattern id={patId} width={TILE} height={TILE} patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotate})`}>
            <PatternTile pattern={pattern} color2={color2} />
          </Pattern>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Rect x={0} y={0} width={width} height={h} fill={color} />
          <Rect x={0} y={0} width={width} height={h} fill={`url(#${patId})`} opacity={0.7} />
          {/* A light sheen along the top edge makes it read as tape. */}
          <Rect x={0} y={0} width={width} height={h * 0.3} fill={withAlpha('#FFFFFF', 0.25)} />
        </G>
      </Svg>
    </View>
  );
});
