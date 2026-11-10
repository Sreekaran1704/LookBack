import { memo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { seededRng } from '../../lib/seeded';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/yearColors';
import { Raster } from './Raster';
import { useSvgId } from './shared';

interface Props {
  /** What stands on each shelf, top shelf first: book spines, left to right. */
  shelves: ReactNode[][];
  /** Sits at the right end of the bottom shelf (a bookend). */
  decor?: ReactNode;
  width: number;
}

/** Gap between books standing side by side on a shelf. */
export const BOOK_GAP = 3;
/** Room left on a shelf (each side) inside the side boards. */
export const SHELF_INSET = 12;

/** Thickness of the cupboard's side boards, the crown on top and each shelf. */
export const CUPBOARD_FRAME = 14;
const CROWN = 20;
const SHELF = 15;
const PLANKS = 4;
const FOOT_W = 26;
const FOOT_H = 12;
const GRAIN_LIGHT = '#FFFFFF';
const GRAIN_DARK = '#000000';

/**
 * A little wooden cupboard with open shelves; the year diaries stand on them upright, spines out. Drawn in code:
 * a back panel of vertical planks with wood grain, side boards, a crown on top, shelves whose front
 * edges catch the light and cast a soft shadow below, and two feet. The wood is drawn once and kept
 * as a texture, so it costs nothing while scrolling.
 */
export const Cupboard = memo(function Cupboard({ shelves, decor, width }: Props) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const [height, setHeight] = useState(0);
  const panelId = useSvgId('panel');
  const shadeId = useSvgId('shade');

  const innerW = width - CUPBOARD_FRAME * 2;
  // Wavy grain lines on each back plank, seeded so they stay put.
  const grain = (() => {
    if (height <= 0) return [];
    const rng = seededRng('cupboard-grain');
    const plankW = innerW / PLANKS;
    const lines: string[] = [];
    for (let p = 0; p < PLANKS; p++) {
      for (let k = 0; k < 3; k++) {
        const x = CUPBOARD_FRAME + p * plankW + plankW * (0.2 + k * 0.3) + rng.range(-4, 4);
        let d = `M ${x} ${CROWN}`;
        for (let y = CROWN; y < height; y += 40) d += ` Q ${x + rng.range(-5, 5)} ${y + 20} ${x + rng.range(-2, 2)} ${y + 40}`;
        lines.push(d);
      }
    }
    return lines;
  })();

  return (
    <View style={{ width, paddingBottom: FOOT_H }}>
      {/* The cupboard body, behind the diaries. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Raster>
          <View style={{ width, height: height + FOOT_H }}>
            {height > 0 ? (
              <>
                {/* Feet. */}
                {[spacing.lg, width - spacing.lg - FOOT_W].map((x) => (
                  <View
                    key={x}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: height - 2,
                      width: FOOT_W,
                      height: FOOT_H + 2,
                      backgroundColor: colors.woodDark,
                      borderBottomLeftRadius: radii.card,
                      borderBottomRightRadius: radii.card,
                    }}
                  />
                ))}
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width,
                    height,
                    borderRadius: radii.card,
                    backgroundColor: colors.wood,
                    borderWidth: 1.5,
                    borderColor: colors.woodDeep,
                    boxShadow: theme.shadow(colors.woodDeep, 1.6),
                  }}
                />
                <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
                  <Defs>
                    <LinearGradient id={panelId} x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={colors.woodDeep} />
                      <Stop offset="0.5" stopColor={colors.woodDark} />
                      <Stop offset="1" stopColor={colors.woodDeep} />
                    </LinearGradient>
                    {/* Inside each compartment: darker towards the top, where the shelf above shades it. */}
                    <LinearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={GRAIN_DARK} stopOpacity={0.35} />
                      <Stop offset="0.35" stopColor={GRAIN_DARK} stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  {/* Back panel of vertical planks. */}
                  <Rect x={CUPBOARD_FRAME} y={CROWN} width={innerW} height={height - CROWN - CUPBOARD_FRAME} fill={`url(#${panelId})`} />
                  {Array.from({ length: PLANKS - 1 }, (_, p) => (
                    <Rect
                      key={p}
                      x={CUPBOARD_FRAME + ((p + 1) * innerW) / PLANKS}
                      y={CROWN}
                      width={1.5}
                      height={height - CROWN - CUPBOARD_FRAME}
                      fill={GRAIN_DARK}
                      opacity={0.3}
                    />
                  ))}
                  {grain.map((d, i) => (
                    <Path key={i} d={d} stroke={i % 2 ? GRAIN_LIGHT : GRAIN_DARK} strokeWidth={1} opacity={i % 2 ? 0.07 : 0.12} fill="none" />
                  ))}
                  <Rect x={CUPBOARD_FRAME} y={CROWN} width={innerW} height={height - CROWN - CUPBOARD_FRAME} fill={`url(#${shadeId})`} />
                  {/* Crown: a thicker board on top, its front edge lit. */}
                  <Rect x={0} y={0} width={width} height={CROWN} rx={radii.card} fill={colors.woodLight} />
                  <Rect x={0} y={CROWN - 4} width={width} height={4} fill={GRAIN_DARK} opacity={0.18} />
                  <Rect x={4} y={3} width={width - 8} height={2} rx={1} fill={GRAIN_LIGHT} opacity={0.35} />
                  {/* Side boards catch a strip of light. */}
                  <Rect x={3} y={CROWN} width={2} height={height - CROWN - 6} fill={GRAIN_LIGHT} opacity={0.2} />
                  <Rect x={width - 5} y={CROWN} width={2} height={height - CROWN - 6} fill={GRAIN_DARK} opacity={0.2} />
                </Svg>
              </>
            ) : null}
          </View>
        </Raster>
      </View>

      {/* Shelves with the diaries standing on them, spines out. */}
      <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)} style={{ paddingTop: CROWN, paddingHorizontal: CUPBOARD_FRAME }}>
        {shelves.map((row, r) => (
          <View key={r}>
            <View style={[styles.row, { paddingTop: spacing.xl, paddingHorizontal: SHELF_INSET, gap: BOOK_GAP }]}>
              {row}
              {r === shelves.length - 1 && decor ? <View style={styles.decor}>{decor}</View> : null}
            </View>
            <Shelf last={r === shelves.length - 1} />
          </View>
        ))}
      </View>
    </View>
  );
});

/** One shelf board: a lit front edge and a soft shadow on the back panel below it. */
function Shelf({ last }: { last: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        height: SHELF,
        marginHorizontal: -CUPBOARD_FRAME,
        backgroundColor: last ? colors.wood : colors.woodLight,
        borderTopWidth: 2,
        borderTopColor: withAlpha(GRAIN_LIGHT, 0.35),
        borderBottomWidth: last ? 0 : 3,
        borderBottomColor: colors.woodDark,
        boxShadow: last ? undefined : `0px 6px 8px ${withAlpha(GRAIN_DARK, 0.35)}`,
        zIndex: 1,
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  decor: { marginLeft: 'auto' },
});
