import { Canvas, ColorMatrix, drawAsImage, FractalNoise, Group, Image as SkiaImage, LinearGradient, Path, RadialGradient, Rect, Skia, vec, type SkImage } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { mulberry32 } from '../../lib/seeded';
import { mixHex } from '../../theme/yearColors';
import { useTheme } from '../../theme';
import { Texture } from './Texture';

export type PaperVariant = 'grid' | 'dots' | 'lined' | 'kraft' | 'cork' | 'plain';

interface Props {
  variant?: PaperVariant;
  /** Base color override (e.g. a year tint). */
  color?: string;
  /** Screen background: the chosen paper (by day or lamplight), plain, lit from the top left. */
  desk?: boolean;
  /** For a `desk` page: a year color to tint the paper with (inside a year's diary). */
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
/** Printed dots aren't all the same: some take a little less ink, and none sit exactly on the grid. */
const DOT_JITTER = 0.35;
const FAINT_DOT_SHARE = 0.3;
/** The desk page: the chosen paper, plain, with light from the top left and a shade where it curves into the binding. */
const DESK_SHEEN = 0.18;
const DESK_VIGNETTE = 0.16;
const BINDING_W = 26;
const BINDING_SHADE = 0.16;
/** How much of a year's color tints the page inside that year's diary. */
const DESK_WASH = 0.22;

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
  const washed = desk && wash ? mixHex(colors.desk, wash, DESK_WASH) : undefined;

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

  // The dots that took a little less ink: drawn once per page size.
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

  const patternIsFill = variant === 'dots' || variant === 'cork';
  const patternColor = variant === 'cork' ? colors.corkDark : variant === 'lined' ? colors.ruleLine : colors.gridLine;
  const grainColor = midnight ? colors.grain : colors.shadowBase;
  const grainStrength = midnight ? opacity.grainDark : opacity.grainLight;
  const grainBoost = midnight ? GRAIN_BOOST_BLACK : GRAIN_BOOST_PAPER;

  const key = [base, variant, desk, midnight, Math.round(width), Math.round(height), patternColor, grainColor, grainStrength].join('|');
  const [painted, setPainted] = useState<{ key: string; image: SkImage } | null>(null);
  const cached = paperCache.get(key);
  const image = cached ?? (painted?.key === key ? painted.image : null);

  const deskPaper = desk && width > 0 ? (
        <>
          <Rect x={0} y={0} width={width} height={height} color={base} />
          {/* Cloudy mottling: the sheet is not perfectly even. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={MOTTLE_FREQ} freqY={MOTTLE_FREQ} octaves={2} seed={3} />
            <ColorMatrix matrix={grainMatrix(midnight ? '#000000' : colors.shadowBase, grainStrength * MOTTLE_STRENGTH)} />
          </Rect>
          {/* Fine grain. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={0.9} freqY={0.9} octaves={3} seed={7} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * grainBoost)} />
          </Rect>
          {/* Light falling from the top left, the edges a touch darker. */}
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient c={vec(width * 0.25, height * 0.1)} r={Math.max(width, height) * 0.8} colors={[`#FFFFFF${alphaHex(midnight ? DESK_SHEEN * 0.3 : DESK_SHEEN)}`, '#FFFFFF00']} />
          </Rect>
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient c={vec(width / 2, height * 0.45)} r={Math.max(width, height) * 0.8} colors={[`${EDGE_SHADE}00`, `${EDGE_SHADE}00`, `${EDGE_SHADE}${alphaHex(midnight ? DESK_VIGNETTE * 2.5 : DESK_VIGNETTE)}`]} positions={[0, 0.55, 1]} />
          </Rect>
          {/* Where the page curves into the binding. */}
          <Rect x={0} y={0} width={BINDING_W} height={height}>
            <LinearGradient start={vec(0, 0)} end={vec(BINDING_W, 0)} colors={[`${EDGE_SHADE}${alphaHex(midnight ? BINDING_SHADE * 2 : BINDING_SHADE)}`, `${EDGE_SHADE}00`]} />
          </Rect>
        </>
      ) : null;

  const layers = desk ? deskPaper : width > 0 ? (
        <>
          <Rect x={0} y={0} width={width} height={height} color={base} />

          {/* Cloudy mottling: the sheet is not perfectly even. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={MOTTLE_FREQ} freqY={MOTTLE_FREQ} octaves={2} seed={3} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * MOTTLE_STRENGTH)} />
          </Rect>


          {pattern ? (
            <Path path={pattern} color={patternColor} style={patternIsFill ? 'fill' : 'stroke'} strokeWidth={1} />
          ) : null}
          {faintDots ? <Path path={faintDots} color={patternColor} style="fill" opacity={0.55} /> : null}


          {/* Fine paper grain. */}
          <Rect x={0} y={0} width={width} height={height}>
            <FractalNoise freqX={0.9} freqY={0.9} octaves={3} seed={7} />
            <ColorMatrix matrix={grainMatrix(grainColor, grainStrength * grainBoost)} />
          </Rect>

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
      {/* The sheet's fibres and specks. */}
      {desk ? <Texture kind="paper" opacity={midnight ? 0.18 : 0.28} /> : null}
    </View>
  );
});
