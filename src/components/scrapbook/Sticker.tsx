import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';
import type { StickerKind } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { shapeShadow } from './shared';

interface Props {
  kind: StickerKind;
  size?: number;
  color: string;
  color2?: string;
  style?: StyleProp<ViewStyle>;
}

const VIEW = 40;
const OUTLINE = 3.2;
const WHITE = '#FFFFFF';
const INK = '#2A2118';

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

const HEART = 'M20 34 C 6 24, 4 14, 11 9 C 15 6, 19 8, 20 12 C 21 8, 25 6, 29 9 C 36 14, 34 24, 20 34 Z';
const MOON = 'M27 6 A 15 15 0 1 0 34 27 A 12 12 0 1 1 27 6 Z';

function Shape({ kind, color, color2 }: { kind: StickerKind; color: string; color2: string }) {
  // Each shape is drawn twice: a thick white "die-cut" outline, then the colored sticker.
  const cut = { stroke: WHITE, strokeWidth: OUTLINE * 2, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'star':
      return (
        <>
          <Polygon points={starPoints(20, 21, 16, 7.5)} fill={WHITE} {...cut} />
          <Polygon points={starPoints(20, 21, 16, 7.5)} fill={color} />
          <Polygon points={starPoints(18, 18, 5, 2.4)} fill={WHITE} opacity={0.45} />
        </>
      );
    case 'heart':
      return (
        <>
          <Path d={HEART} fill={WHITE} {...cut} />
          <Path d={HEART} fill={color} />
          <Circle cx={14} cy={14} r={2.4} fill={WHITE} opacity={0.5} />
        </>
      );
    case 'sun':
      return (
        <>
          <Circle cx={20} cy={20} r={17} fill={WHITE} />
          <G stroke={color2} strokeWidth={3} strokeLinecap="round">
            {Array.from({ length: 8 }, (_, i) => {
              const a = (Math.PI / 4) * i;
              return (
                <Path
                  key={i}
                  d={`M ${20 + Math.cos(a) * 11} ${20 + Math.sin(a) * 11} L ${20 + Math.cos(a) * 15.5} ${20 + Math.sin(a) * 15.5}`}
                />
              );
            })}
          </G>
          <Circle cx={20} cy={20} r={8.5} fill={color} />
        </>
      );
    case 'moon':
      return (
        <>
          <Path d={MOON} fill={WHITE} {...cut} />
          <Path d={MOON} fill={color} />
          <Circle cx={16} cy={22} r={1.8} fill={WHITE} opacity={0.4} />
        </>
      );
    case 'smiley':
      return (
        <>
          <Circle cx={20} cy={20} r={16} fill={WHITE} />
          <Circle cx={20} cy={20} r={13} fill={color} />
          <Circle cx={15.5} cy={17} r={1.8} fill={INK} />
          <Circle cx={24.5} cy={17} r={1.8} fill={INK} />
          <Path d="M 14 23 Q 20 29 26 23" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      );
  }
}

/** Die-cut sticker. Soft shape shadow in light mode, colored glow in midnight mode. */
export const Sticker = memo(function Sticker({ kind, size, color, color2, style }: Props) {
  const theme = useTheme();
  const s = size ?? theme.sizes.sticker;
  return (
    <View pointerEvents="none" style={[{ width: s, height: s }, shapeShadow(theme, color), style]}>
      <Svg width={s} height={s} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Shape kind={kind} color={color} color2={color2 ?? color} />
      </Svg>
    </View>
  );
});
