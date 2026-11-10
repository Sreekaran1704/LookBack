import { memo, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { raggedOffsets } from '../../lib/seeded';
import { useTheme } from '../../theme';

interface Props {
  width: number;
  text: string;
  paper: string;
  tint: string;
  seed: number;
  ruled?: boolean;
  folded?: boolean;
  /** Small handwritten line under the text (e.g. a date). */
  footer?: string;
  numberOfLines?: number;
  lift?: number;
}

/** Notes up to this many characters are written in handwriting; longer ones use the readable body font. */
const HANDWRITTEN_MAX = 110;
const EDGE_STEP = 9;

function tornEdgePath(width: number, depth: number, seed: number): string {
  const count = Math.ceil(width / EDGE_STEP) + 1;
  const offsets = raggedOffsets(seed, count, depth);
  let d = `M 0 0 L ${width} 0`;
  for (let i = count - 1; i >= 0; i--) d += ` L ${Math.min(width, i * EDGE_STEP)} ${depth * 0.3 + (offsets[i] ?? 0) * 0.7}`;
  return `${d} Z`;
}

/** A note on lined or plain paper with a ragged torn bottom edge and an optional folded corner. */
export const TornNote = memo(function TornNote({
  width,
  text,
  paper,
  tint,
  seed,
  ruled = true,
  folded = false,
  footer,
  numberOfLines,
  lift = 1,
}: Props) {
  const theme = useTheme();
  const { colors, sizes, spacing, typography } = theme;
  const [height, setHeight] = useState(0);
  const handwritten = text.length <= HANDWRITTEN_MAX;
  const textStyle = handwritten ? typography.hand : typography.body;
  const lineGap = textStyle.lineHeight ?? sizes.ruledLineGap;
  const edge = sizes.tornEdgeHeight;
  const fold = sizes.foldSize;
  const edgePath = useMemo(() => tornEdgePath(width, edge, seed), [width, edge, seed]);

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);
  const pad = spacing.lg;
  const lines = ruled && !theme.lite && height > 0 ? Math.floor((height - pad) / lineGap) : 0;

  return (
    <View style={{ width }}>
      <View
        onLayout={onLayout}
        style={{
          backgroundColor: paper,
          paddingHorizontal: pad,
          paddingTop: pad,
          paddingBottom: spacing.sm,
          boxShadow: theme.shadow(tint, lift),
        }}
      >
        {lines > 0 ? (
          <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            {Array.from({ length: lines }, (_, i) => {
              const y = pad + lineGap * (i + 1) - 4;
              return <Line key={i} x1={0} x2={width} y1={y} y2={y} stroke={colors.ruleLine} strokeWidth={1} />;
            })}
            <Line x1={pad * 1.6} x2={pad * 1.6} y1={0} y2={height} stroke={colors.marginLine} strokeWidth={1} />
          </Svg>
        ) : null}
        <Text style={[textStyle, { color: colors.ink, paddingLeft: ruled ? pad : 0 }]} numberOfLines={numberOfLines}>
          {text}
        </Text>
        {footer ? (
          <Text style={[typography.handSmall, { color: colors.inkMuted, textAlign: 'right', marginTop: spacing.xs }]}>
            {footer}
          </Text>
        ) : null}
        {folded ? (
          <View style={{ position: 'absolute', right: 0, top: 0, width: fold, height: fold }}>
            <Svg width={fold} height={fold}>
              {/* Dog-ear: the corner is folded down over the note (darker underside + crease). */}
              <Path d={`M 0 0 L ${fold} ${fold} L 0 ${fold} Z`} fill={colors.paperWhite} />
              <Path d={`M 0 0 L ${fold} ${fold} L 0 ${fold} Z`} fill={colors.inkFaint} />
              <Path d={`M 0 0 L ${fold} ${fold}`} stroke={colors.inkFaint} strokeWidth={1} />
            </Svg>
          </View>
        ) : null}
      </View>
      <Svg width={width} height={edge} style={{ marginTop: -0.5 }}>
        <Path d={edgePath} fill={paper} />
      </Svg>
    </View>
  );
});
