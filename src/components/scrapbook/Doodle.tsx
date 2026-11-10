import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { mulberry32 } from '../../lib/seeded';
import { useTheme } from '../../theme';

export type DoodleKind = 'underline' | 'highlight' | 'circle' | 'arrow' | 'stitch';

interface Props {
  kind: DoodleKind;
  width: number;
  height: number;
  color: string;
  seed?: number;
  style?: StyleProp<ViewStyle>;
}

function wobble(seed: number) {
  const r = mulberry32(seed);
  return (amount: number) => (r() - 0.5) * 2 * amount;
}

function doodlePath(kind: DoodleKind, w: number, h: number, seed: number): string {
  const j = wobble(seed);
  switch (kind) {
    case 'underline': {
      const y = h * 0.6;
      return `M 2 ${y + j(2)} C ${w * 0.3} ${y - h * 0.4 + j(2)}, ${w * 0.6} ${y + h * 0.4 + j(2)}, ${w - 2} ${y - h * 0.15 + j(2)}`;
    }
    case 'highlight':
      return `M 4 ${h * 0.62 + j(2)} Q ${w * 0.5} ${h * 0.5 + j(3)} ${w - 4} ${h * 0.58 + j(2)}`;
    case 'circle': {
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2 - 3;
      const ry = h / 2 - 3;
      return `M ${cx + rx * 0.9} ${cy - ry * 0.75} C ${cx + rx * 1.15} ${cy + ry * 0.4}, ${cx + rx * 0.3} ${cy + ry * 1.1}, ${cx - rx * 0.4} ${cy + ry * 0.95}
        C ${cx - rx * 1.15} ${cy + ry * 0.7}, ${cx - rx * 1.05} ${cy - ry * 0.85}, ${cx - rx * 0.1} ${cy - ry * 1.02}
        C ${cx + rx * 0.5} ${cy - ry * 1.1}, ${cx + rx * 0.95} ${cy - ry * 0.6}, ${cx + rx * 0.75 + j(2)} ${cy - ry * 0.2 + j(2)}`;
    }
    case 'arrow':
      return `M 3 ${h * 0.25} Q ${w * 0.45} ${h * 1.05 + j(3)} ${w - 6} ${h * 0.6}
        M ${w - 16} ${h * 0.38 + j(1)} L ${w - 5} ${h * 0.6} L ${w - 18} ${h * 0.76 + j(1)}`;
    case 'stitch':
      return `M 0 ${h / 2} L ${w} ${h / 2}`;
  }
}

/** Hand-drawn marks: wavy underline, highlighter swipe, scribbled circle, arrow, stitched line. */
export const Doodle = memo(function Doodle({ kind, width, height, color, seed = 1, style }: Props) {
  const theme = useTheme();
  const stroke = theme.sizes.doodleStroke;
  const isHighlight = kind === 'highlight';
  return (
    <View pointerEvents="none" style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Path
          d={doodlePath(kind, width, height, seed)}
          stroke={color}
          strokeWidth={isHighlight ? height * 0.55 : stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={kind === 'stitch' ? '6 5' : undefined}
          opacity={isHighlight ? 0.5 : 1}
          fill="none"
        />
      </Svg>
    </View>
  );
});
