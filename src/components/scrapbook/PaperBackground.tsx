import { Canvas, ColorMatrix, drawAsImage, FractalNoise, Group, Image as SkiaImage, LinearGradient, Path, RadialGradient, Rect, Skia, vec, type SkImage } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
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
/** Paper fibres: short faint strands in the sheet, one per this many square points. */
const FIBRE_AREA = 900;
const FIBRE_ALPHA = 0.07;
/** Printed dots aren't all the same: some take a little less ink, and none sit exactly on the grid. */
const DOT_JITTER = 0.35;
const FAINT_DOT_SHARE = 0.3;
/** Light falls from the top left, and the page curves into the binding on the left. */
const LIGHT_ALPHA = 0.16;
const SHADE_ALPHA = 0.07;
const GUTTER_W = 26;
const GUTTER_ALPHA = 0.1;

/**
 * Each paper (color, pattern, tone, size) is painted once into an image and shared by every page that uses it.
 * Painting it live (noise for the grain and mottling, thousands of dots and fibres) cost ~23 ms on the UI thread
 * every time a page was drawn, which made a page sliding in for the first time stutter. A few are kept.
 */
const PAPER_CACHE_SIZE = 6;
const paperCache = new Map<string, SkImage>();
const paperPending = new Map<string, Promise<SkImage | null>>();
function rememberPaper(key: string, image: SkImage) {
  paperCache.delete(key);
  paperCache.set(key, image);
  while (paperCache.size > PAPER_CACHE_SIZE) {
    const oldest = paperCache.keys().next().value;
    if (oldest === undefined) break;
    paperCache.delete(oldest);
  }
}

const alphaHex = (a: number) =>
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');

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
      const rnd = mulberry32(17);
      for (let x = DOT_GAP / 2; x < width; x += DOT_GAP) {
        for (let y = DOT_GAP / 2; y < height; y += DOT_GAP) {
          // The same draws, in the same order, as faintDots: the fainter ones are drawn there.
          const faint = rnd() < FAINT_DOT_SHARE;
          const jx = (rnd() - 0.5) * DOT_JITTER * 2;
          const jy = (rnd() - 0.5) * DOT_JITTER * 2;
          const r = DOT_RADIUS * (0.85 + rnd() * 0.3);
          if (!faint) path.addCircle(x + jx, y + jy, r);
        }
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

  // The dots that took a little less ink, and the paper's fibres: drawn once per page size.
  const faintDots = useMemo(() => {
    if (width === 0 || variant !== 'dots') return null;
    const rnd = mulberry32(17);
    const path = Skia.PathBuilder.Make();
    for (let x = DOT_GAP / 2; x < width; x += DOT_GAP) {
      for (let y = DOT_GAP / 2; y < height; y += DOT_GAP) {
        const faint = rnd() < FAINT_DOT_SHARE;
        const jx = (rnd() - 0.5) * DOT_JITTER * 2;
        const jy = (rnd() - 0.5) * DOT_JITTER * 2;
        const r = DOT_RADIUS * (0.85 + rnd() * 0.3);
        if (faint) path.addCircle(x + jx, y + jy, r * 0.9);
      }
    }
    return path.detach();
  }, [variant, width, height]);
  const fibres = useMemo(() => {
    if (width === 0 || !desk) return null;
    const rnd = mulberry32(Math.round(width * 7 + height));
    const path = Skia.PathBuilder.Make();
    const count = Math.round((width * height) / FIBRE_AREA);
    for (let i = 0; i < count; i++) {
      const x = rnd() * width;
      const y = rnd() * height;
      const len = 3 + rnd() * 9;
      const a = rnd() * Math.PI;
      const bend = (rnd() - 0.5) * len * 0.6;
      path.moveTo(x, y);
      path.quadTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    return path.detach();
  }, [desk, width, height]);

  const patternIsFill = variant === 'dots' || variant === 'cork';
  const patternColor = variant === 'cork' ? colors.corkDark : variant === 'lined' ? colors.ruleLine : colors.gridLine;
  const grainColor = midnight ? colors.grain : colors.shadowBase;
  const grainStrength = midnight ? opacity.grainDark : opacity.grainLight;
  const grainBoost = midnight ? GRAIN_BOOST_BLACK : GRAIN_BOOST_PAPER;

  const key = [base, variant, desk, midnight, Math.round(width), Math.round(height), patternColor, grainColor, grainStrength, colors.marginLine].join('|');
  const [painted, setPainted] = useState<{ key: string; image: SkImage } | null>(null);
  const cached = paperCache.get(key);
  const image = cached ?? (painted?.key === key ? painted.image : null);

  const layers = width > 0 ? (
        <>
          <Rect x={0} y={0} width={width} height={height} color={base} />

          {/* Cloudy mottling: the sheet is not perfectly even. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={MOTTLE_FREQ} freqY={MOTTLE_FREQ} octaves={2} seed={3} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * MOTTLE_STRENGTH)} />
          </Rect>

          {/* Fibres in the sheet. */}
          {fibres ? <Path path={fibres} color={grainColor} style="stroke" strokeWidth={0.6} opacity={FIBRE_ALPHA * (midnight ? 1.4 : 1)} /> : null}

          {pattern ? (
            <Path path={pattern} color={patternColor} style={patternIsFill ? 'fill' : 'stroke'} strokeWidth={1} />
          ) : null}
          {faintDots ? <Path path={faintDots} color={patternColor} style="fill" opacity={0.55} /> : null}

          {desk ? <Rect x={MARGIN_X} y={0} width={MARGIN_W} height={height} color={colors.marginLine} /> : null}

          {/* Fine paper grain. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={0.9} freqY={0.9} octaves={3} seed={7} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * grainBoost)} />
          </Rect>

          {/* Light from the top left: the sheet is a touch brighter there and a touch duskier in the far corner. */}
          {desk ? (
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(width, height)}
                colors={[`#FFFFFF${alphaHex(midnight ? LIGHT_ALPHA * 0.25 : LIGHT_ALPHA)}`, '#FFFFFF00', `${EDGE_SHADE}00`, `${EDGE_SHADE}${alphaHex(midnight ? SHADE_ALPHA * 1.5 : SHADE_ALPHA)}`]}
                positions={[0, 0.4, 0.6, 1]}
              />
            </Rect>
          ) : null}
          {/* The page curves down into the binding on the left: a soft shade along that edge. */}
          {desk ? (
            <Rect x={0} y={0} width={GUTTER_W} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(GUTTER_W, 0)}
                colors={[`${EDGE_SHADE}${alphaHex(midnight ? GUTTER_ALPHA * 2 : GUTTER_ALPHA)}`, `${EDGE_SHADE}00`]}
              />
            </Rect>
          ) : null}

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
        </>
      ) : null;

  // Paint this paper into an image once (at the screen's pixel density), then just show the image.
  useEffect(() => {
    if (width === 0 || paperCache.has(key) || !layers) return;
    let alive = true;
    const pr = PixelRatio.get();
    let job = paperPending.get(key);
    if (!job) {
      job = drawAsImage(<Group transform={[{ scale: pr }]}>{layers}</Group>, { width: Math.round(width * pr), height: Math.round(height * pr) });
      paperPending.set(key, job);
    }
    job
      .then((img) => {
        paperPending.delete(key);
        if (!img) return;
        rememberPaper(key, img);
        if (alive) setPainted({ key, image: img });
      })
      .catch(() => paperPending.delete(key));
    return () => {
      alive = false;
    };
    // `layers` is rebuilt every render; `key` holds everything it is drawn from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width]);

  return (
    <View style={[StyleSheet.absoluteFill, style]} onLayout={onLayout} pointerEvents="none">
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {image ? <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="fill" /> : layers}
        </Canvas>
      ) : null}
    </View>
  );
});
