import { Canvas, ColorMatrix, FractalNoise, Path, RadialGradient, Rect, Skia, vec } from '@shopify/react-native-skia';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { mulberry32 } from '../../lib/seeded';
import { mixHex } from '../../theme/yearColors';
import { useTheme } from '../../theme';

export type PaperVariant = 'grid' | 'dots' | 'lined' | 'kraft' | 'cork' | 'plain';

interface Props {
  variant?: PaperVariant;
  /** Base color override (e.g. a year tint). */
  color?: string;
  /** Screen background: a sheet of paper. Cream in light mode, black paper in dark mode. */
  desk?: boolean;
  /** For a `desk` page in light mode: a year color to wash the paper with (the same look as inside a diary). */
  wash?: string;
  style?: StyleProp<ViewStyle>;
}

const GRID_GAP = 22;
const DOT_GAP = 20;
const DOT_RADIUS = 1.3;
const LINE_GAP = 30;
const GRAIN_BOOST_PAPER = 4;
const GRAIN_BOOST_BLACK = 2.6;
/** Slow, cloudy unevenness under the fine grain, like handmade paper. */
const MOTTLE_FREQ = 0.012;
const MOTTLE_STRENGTH = 0.55;
const EDGE_SHADE = '#000000';
/** Every screen is a page of the same notebook: a red margin line runs down the left edge. */
const MARGIN_X = 11;
const MARGIN_W = 1.2;

/** Grain: map the noise's red channel to alpha of a single color. */
function grainMatrix(hex: string, strength: number): number[] {
  const c = Skia.Color(hex);
  return [0, 0, 0, 0, c[0] ?? 0, 0, 0, 0, 0, c[1] ?? 0, 0, 0, 0, 0, c[2] ?? 0, strength, 0, 0, 0, -strength * 0.45];
}

/**
 * Textured paper drawn with Skia: base color, grid/dots/lines, cloudy mottling and fine grain.
 * A `desk` background is the page itself: cream paper in light mode, black paper (pale grain and
 * faint pale lines, darker towards the edges) in dark mode.
 */
export const PaperBackground = memo(function PaperBackground({ variant = 'grid', color, desk = false, wash, style }: Props) {
  const theme = useTheme();
  const { colors, opacity } = theme;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };
  const { width, height } = size;
  const midnight = theme.dark && desk;
  const washed = desk && !theme.dark && wash ? mixHex(colors.desk, wash, opacity.pageWash) : undefined;

  const base =
    color ??
    washed ??
    (variant === 'kraft'
      ? colors.kraft
      : variant === 'cork'
        ? colors.cork
        : midnight
          ? colors.desk
          : theme.dark
            ? colors.paper
            : colors.desk);

  const pattern = useMemo(() => {
    if (width === 0) return null;
    const path = Skia.PathBuilder.Make();
    if (variant === 'grid') {
      for (let x = GRID_GAP; x < width; x += GRID_GAP) {
        path.moveTo(x, 0);
        path.lineTo(x, height);
      }
      for (let y = GRID_GAP; y < height; y += GRID_GAP) {
        path.moveTo(0, y);
        path.lineTo(width, y);
      }
    } else if (variant === 'dots') {
      for (let x = DOT_GAP / 2; x < width; x += DOT_GAP) {
        for (let y = DOT_GAP / 2; y < height; y += DOT_GAP) path.addCircle(x, y, DOT_RADIUS);
      }
    } else if (variant === 'lined') {
      for (let y = LINE_GAP; y < height; y += LINE_GAP) {
        path.moveTo(0, y);
        path.lineTo(width, y);
      }
    } else if (variant === 'cork') {
      // Cork specks.
      const rnd = mulberry32(Math.round(width * 13 + height));
      const count = Math.round((width * height) / 260);
      for (let i = 0; i < count; i++) path.addCircle(rnd() * width, rnd() * height, 0.6 + rnd() * 1.6);
    }
    return path.detach();
  }, [variant, width, height]);

  const patternIsFill = variant === 'dots' || variant === 'cork';
  const patternColor = variant === 'cork' ? colors.corkDark : variant === 'lined' ? colors.ruleLine : colors.gridLine;
  const grainColor = midnight ? colors.grain : colors.shadowBase;
  const grainStrength = midnight ? opacity.grainDark : opacity.grainLight;
  const grainBoost = midnight ? GRAIN_BOOST_BLACK : GRAIN_BOOST_PAPER;

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout} pointerEvents="none">
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={width} height={height} color={base} />

          {/* Cloudy mottling: the sheet is not perfectly even. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={MOTTLE_FREQ} freqY={MOTTLE_FREQ} octaves={2} seed={3} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * MOTTLE_STRENGTH)} />
          </Rect>

          {pattern ? (
            <Path path={pattern} color={patternColor} style={patternIsFill ? 'fill' : 'stroke'} strokeWidth={1} />
          ) : null}

          {desk ? <Rect x={MARGIN_X} y={0} width={MARGIN_W} height={height} color={colors.marginLine} /> : null}

          {/* Fine paper grain. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={0.9} freqY={0.9} octaves={3} seed={7} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * grainBoost)} />
          </Rect>

          {/* Black paper gets darker towards the edges. */}
          {midnight ? (
            <Rect x={0} y={0} width={width} height={height}>
              <RadialGradient
                c={vec(width / 2, height * 0.45)}
                r={Math.max(width, height) * 0.8}
                colors={[`${EDGE_SHADE}00`, `${EDGE_SHADE}00`, `${EDGE_SHADE}${Math.round(opacity.vignette * 255).toString(16)}`]}
                positions={[0, 0.55, 1]}
              />
            </Rect>
          ) : null}
        </Canvas>
      ) : null}
    </View>
  );
});
