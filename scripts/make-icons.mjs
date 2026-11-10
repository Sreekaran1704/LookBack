/**
 * Paints the app icon, Android adaptive icon layers, splash image and favicon into ./assets.
 * Uses CanvasKit (Skia for Node, already installed with react-native-skia) so the bunny here is
 * drawn with the same shapes, gradients and blurs as the in-app Buddy (src/components/scrapbook/Buddy.tsx).
 *
 *   node scripts/make-icons.mjs
 *
 * Re-run after changing the buddy's look or the brand colors, then rebuild the app.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CanvasKitInit = require('canvaskit-wasm');
const CK = await CanvasKitInit({ locateFile: (file) => path.join(root, 'node_modules/canvaskit-wasm/bin', file) });

// Same values as src/theme/tokens.ts and yearColors.ts.
const C = {
  fur: '#FFF3E4',
  shade: '#E3C3A8',
  blush: '#FF9DB0',
  ear: '#FFC4D0',
  nose: '#F0879C',
  outline: '#A9876B',
  shadow: '#5B3E1F',
  face: '#3B2A2A',
  white: '#FFFFFF',
  ink: '#2A2118',
  paper: '#FFE9E1', // warm peach page
  dots: '#F29A86',
  margin: '#E85454',
  coral: '#FF6B5E',
  highlight: '#FFB347',
  splashLight: '#FBF5E6', // tokens: palette.cream (light desk)
  splashDark: '#1B1A18', // tokens: palette.deskNight (dark desk)
};

const DIE_CUT = 5.5;
const OUTLINE = 1.3;

function color(hex, alpha = 1) {
  const n = parseInt(hex.slice(1), 16);
  return CK.Color((n >> 16) & 255, (n >> 8) & 255, n & 255, alpha);
}
function paint({ hex = '#000000', alpha = 1, stroke = 0, blur = 0 } = {}) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  p.setColor(color(hex, alpha));
  if (stroke > 0) {
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeJoin(CK.StrokeJoin.Round);
    p.setStrokeCap(CK.StrokeCap.Round);
  }
  if (blur > 0) p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, blur, true));
  return p;
}
function radial(cx, cy, r, stops, positions) {
  const p = paint();
  p.setShader(CK.Shader.MakeRadialGradient([cx, cy], r, stops.map((h) => color(h)), positions, CK.TileMode.Clamp));
  return p;
}
const oval = (canvas, x, y, w, h, p) => canvas.drawOval(CK.XYWHRect(x, y, w, h), p);
function rotated(canvas, deg, px, py, draw) {
  canvas.save();
  canvas.rotate(deg, px, py);
  draw();
  canvas.restore();
}
const svg = (d) => CK.Path.MakeFromSVGString(d);

const BODY = svg('M50 31 C 71 31, 84 45, 84 62 C 84 80, 70 91, 50 91 C 30 91, 16 80, 16 62 C 16 45, 29 31, 50 31 Z');
const SMILE = svg('M46.2 66.2 Q 48.1 68.9 50 66.2 Q 51.9 68.9 53.8 66.2');
const OPEN_MOUTH = svg('M46 66 Q 50 74.5 54 66 Q 50 67.6 46 66 Z');
const EYE_SHUT_L = svg('M36.6 58.4 Q 40.8 62 45 58.4');
const EYE_SHUT_R = svg('M55 58.4 Q 59.2 62 63.4 58.4');
const EYE_JOY_L = svg('M36.6 59.6 Q 40.8 53.6 45 59.6');
const EYE_JOY_R = svg('M55 59.6 Q 59.2 53.6 63.4 59.6');
const BOW = svg('M61 33.5 L 53.5 28.8 Q 52.2 33.5 53.5 38.2 Z M61 33.5 L 68.5 28.8 Q 69.8 33.5 68.5 38.2 Z');
const ZZZ = svg('M82 22 L 89 22 L 82 29 L 89 29 M91 10 L 96 10 L 91 15 L 96 15');
const FUR = [C.white, C.fur, C.shade];
const MOUTH = '#C65B70';
const ZZZ_INK = '#9C8B7A';

/** The bow on its own, in its place on the 100-unit box. In the app it is tinted with the year's color. */
function drawBow(canvas, hex) {
  canvas.drawPath(BOW, paint({ hex }));
  canvas.drawCircle(61, 33.5, 2.3, paint({ hex }));
}

/**
 * The bunny in its 100-unit box, every mood the app uses (same shapes as the old Skia Buddy):
 * 'happy', 'wave', 'sleepy' (ears flop, eyes shut, zzz), 'cheer' (arms up, eyes closed in a smile,
 * open mouth), 'peek' (only ears, face and two paws, as if looking over an edge).
 * bow: a color, or null to leave it out (the app overlays a tinted bow).
 * mono: one-color silhouette with the face punched out (Android themed icon).
 */
function drawBunny(canvas, { mood = 'happy', bow = C.coral, mono = false } = {}) {
  const waving = mood === 'wave';
  const cheering = mood === 'cheer';
  const sleeping = mood === 'sleepy';
  const peek = mood === 'peek';
  const earL = sleeping ? -68 : cheering ? -16 : -9;
  const earR = sleeping ? 68 : waving ? 24 : cheering ? 16 : 9;

  const silhouette = (p) => {
    if (!peek) {
      canvas.drawCircle(81, 77, 6.5, p);
      oval(canvas, 27, 83, 20, 11, p);
      oval(canvas, 53, 83, 20, 11, p);
    }
    rotated(canvas, earL, 38, 38, () => oval(canvas, 30, 3, 15, 38, p));
    rotated(canvas, earR, 62, 38, () => oval(canvas, 55, 3, 15, 38, p));
    if (cheering) rotated(canvas, -28, 15, 43, () => oval(canvas, 9, 33, 12, 20, p));
    else if (!peek) rotated(canvas, 16, 17, 65.5, () => oval(canvas, 11, 56, 12, 19, p));
    canvas.drawPath(BODY, p);
    if (waving || cheering) rotated(canvas, 28, 85, 43, () => oval(canvas, 79, 33, 12, 20, p));
    else if (!peek) rotated(canvas, -16, 83, 65.5, () => oval(canvas, 77, 56, 12, 19, p));
    if (peek) {
      oval(canvas, 17, 59, 19, 11, p);
      oval(canvas, 64, 59, 19, 11, p);
    }
  };

  if (mono) {
    // Themed icons are one color: the sticker silhouette with the eyes, nose and smile cut out.
    silhouette(paint({ hex: C.white, stroke: DIE_CUT }));
    silhouette(paint({ hex: C.white }));
    const cut = paint({ hex: C.white });
    cut.setBlendMode(CK.BlendMode.Clear);
    oval(canvas, 37, 53.4, 7.6, 9, cut);
    oval(canvas, 55.4, 53.4, 7.6, 9, cut);
    oval(canvas, 47.9, 62.3, 4.2, 3, cut);
    const cutLine = paint({ hex: C.white, stroke: 1.8 });
    cutLine.setBlendMode(CK.BlendMode.Clear);
    canvas.drawPath(SMILE, cutLine);
    return;
  }

  if (!peek) oval(canvas, 22, 87, 56, 10, paint({ hex: C.shadow, alpha: 0.3, blur: 3.5 }));
  // Sticker edge: soft drop shadow, warm outline, white die-cut border, white fill.
  canvas.save();
  canvas.translate(1, 2);
  silhouette(paint({ hex: C.shadow, alpha: 0.3, stroke: DIE_CUT, blur: 2 }));
  canvas.restore();
  silhouette(paint({ hex: C.outline, stroke: DIE_CUT + OUTLINE * 2 }));
  silhouette(paint({ hex: C.white, stroke: DIE_CUT }));
  silhouette(paint({ hex: C.white }));

  const limb = (x, y, w, h, deg = 0) =>
    rotated(canvas, deg, x + w / 2, y + h / 2, () => {
      oval(canvas, x - 1, y + 1.5, w + 2, h + 1, paint({ hex: C.shadow, alpha: 0.22, blur: 2 }));
      oval(canvas, x, y, w, h, radial(x + w * 0.35, y + h * 0.3, Math.max(w, h) * 0.9, FUR, [0, 0.5, 1]));
    });
  if (!peek) {
    canvas.drawCircle(81, 77, 6.5, radial(79, 74, 9, FUR, [0, 0.5, 1]));
    limb(27, 83, 20, 11);
    limb(53, 83, 20, 11);
  }
  const ear = (deg, x, px) =>
    rotated(canvas, deg, px, 38, () => {
      oval(canvas, x, 3, 15, 38, radial(x + 5, 12, 30, FUR, [0, 0.4, 1]));
      oval(canvas, x + 4, 9, 7, 25, paint({ hex: C.ear, blur: 1 }));
    });
  ear(earL, 30, 38);
  ear(earR, 55, 62);
  if (cheering) limb(9, 33, 12, 20, -28);
  else if (!peek) limb(11, 56, 12, 19, 16);

  // Body, lit from the top left, with ambient shading, a pale tummy and a sheen.
  canvas.drawPath(BODY, radial(40, 45, 54, FUR, [0, 0.42, 1]));
  canvas.save();
  canvas.clipPath(BODY, CK.ClipOp.Intersect, true);
  oval(canvas, 8, 72, 84, 34, paint({ hex: C.shade, alpha: 0.6, blur: 8 }));
  oval(canvas, 68, 36, 30, 58, paint({ hex: C.shade, alpha: 0.4, blur: 7 }));
  oval(canvas, 33, 68, 34, 22, paint({ hex: C.white, alpha: 0.6, blur: 5 }));
  rotated(canvas, -24, 36, 41, () => oval(canvas, 26, 36, 21, 10, paint({ hex: C.white, alpha: 0.8, blur: 2.6 })));
  canvas.drawCircle(31.5, 41, 1.5, paint({ hex: C.white }));
  canvas.restore();

  if (bow) {
    drawBow(canvas, bow);
    canvas.drawCircle(60.3, 32.8, 0.8, paint({ hex: C.white, alpha: 0.7 }));
  }

  // Cheeks and face.
  oval(canvas, 23.5, 62, 14, 8.5, paint({ hex: C.blush, alpha: 0.6, blur: 2.6 }));
  oval(canvas, 62.5, 62, 14, 8.5, paint({ hex: C.blush, alpha: 0.6, blur: 2.6 }));
  if (sleeping) {
    canvas.drawPath(EYE_SHUT_L, paint({ hex: C.face, stroke: 2.2 }));
    canvas.drawPath(EYE_SHUT_R, paint({ hex: C.face, stroke: 2.2 }));
  } else if (cheering) {
    canvas.drawPath(EYE_JOY_L, paint({ hex: C.face, stroke: 2.4 }));
    canvas.drawPath(EYE_JOY_R, paint({ hex: C.face, stroke: 2.4 }));
  } else {
    for (const x of [37, 55.4]) {
      oval(canvas, x, 53.4, 7.6, 9, paint({ hex: C.face }));
      canvas.drawCircle(x + 2.5, 56, 1.9, paint({ hex: C.white }));
      canvas.drawCircle(x + 5.2, 60, 0.9, paint({ hex: C.white, alpha: 0.8 }));
    }
  }
  oval(canvas, 47.9, 62.3, 4.2, 3, paint({ hex: C.nose }));
  if (cheering) canvas.drawPath(OPEN_MOUTH, paint({ hex: MOUTH }));
  else canvas.drawPath(SMILE, paint({ hex: C.face, stroke: 1.5 }));

  // Front arm, or two paws gripping the edge.
  if (waving || cheering) limb(79, 33, 12, 20, 28);
  else if (!peek) limb(77, 56, 12, 19, -16);
  if (peek) {
    limb(17, 59, 19, 11);
    limb(64, 59, 19, 11);
  }
  if (sleeping) canvas.drawPath(ZZZ, paint({ hex: ZZZ_INK, stroke: 1.9 }));
}

const caveat = CK.Typeface.MakeTypefaceFromData(
  readFileSync(path.join(root, 'node_modules/@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf')).buffer,
);

/** "LookBack" in Caveat Bold with a highlighter swipe behind it, centered on cx. */
function drawName(canvas, cx, baseline, size, { ink = C.ink, swipe = C.highlight } = {}) {
  const font = new CK.Font(caveat, size);
  const text = 'LookBack';
  const widths = font.getGlyphWidths(font.getGlyphIDs(text));
  const w = widths.reduce((a, b) => a + b, 0);
  const x = cx - w / 2;
  // Highlighter: a wide soft stroke across the lower half of the letters, slightly tilted.
  const hl = paint({ hex: swipe, alpha: 0.75, stroke: size * 0.34 });
  const p = svg(
    `M ${x - size * 0.06} ${baseline - size * 0.16} Q ${cx} ${baseline - size * 0.26} ${x + w + size * 0.04} ${baseline - size * 0.2}`,
  );
  canvas.drawPath(p, hl);
  canvas.drawText(text, x, baseline, paint({ hex: ink }), font);
}

function dottedPaper(canvas, size, { margin = true, bg = C.paper } = {}) {
  canvas.clear(color(bg));
  const gap = size / 16;
  const dot = paint({ hex: C.dots, alpha: 0.45 });
  for (let x = gap / 2; x < size; x += gap) for (let y = gap / 2; y < size; y += gap) canvas.drawCircle(x, y, size / 260, dot);
  if (margin) canvas.drawRect(CK.XYWHRect(size * 0.1, 0, size * 0.006, size), paint({ hex: C.margin, alpha: 0.55 }));
  // Soft vignette towards the corners, like a sheet under a lamp.
  const v = paint();
  v.setShader(
    CK.Shader.MakeRadialGradient(
      [size / 2, size * 0.42],
      size * 0.78,
      [color(C.shadow, 0), color(C.shadow, 0), color(C.shadow, 0.16)],
      [0, 0.6, 1],
      CK.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CK.XYWHRect(0, 0, size, size), v);
}

function render(size, draw, file, height = size) {
  const surface = CK.MakeSurface(size, height);
  const canvas = surface.getCanvas();
  canvas.clear(CK.TRANSPARENT);
  draw(canvas);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes();
  writeFileSync(path.join(root, 'assets', file), bytes);
  surface.delete();
  console.log('wrote assets/' + file);
  return bytes;
}

/** Bunny (in its 100-unit box) placed at (x, y) with `scale` px per unit. */
function bunnyAt(canvas, x, y, scale, opts) {
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(scale, scale);
  drawBunny(canvas, opts);
  canvas.restore();
}

const S = 1024;
const BUDDY_PX = 600;

// iOS / store icon: full-bleed peach page, bunny waving, the name underneath.
const iconBytes = render(
  S,
  (c) => {
    dottedPaper(c, S);
    bunnyAt(c, S / 2 - 6.0 * 50, 70, 6.0, { mood: 'wave' });
    drawName(c, S / 2, 930, 230);
  },
  'icon.png',
);

// Android adaptive icon: background layer = the page, foreground = bunny + name inside the safe zone
// (the middle 66% survives every launcher mask).
render(S, (c) => dottedPaper(c, S, { margin: false }), 'android-icon-background.png');
render(
  S,
  (c) => {
    bunnyAt(c, S / 2 - 3.5 * 50, 262, 3.5, { mood: 'wave' });
    drawName(c, S / 2, 722, 122);
  },
  'android-icon-foreground.png',
);
render(S, (c) => bunnyAt(c, S / 2 - 4.4 * 50, 250, 4.4, { mood: 'wave', mono: true }), 'android-icon-monochrome.png');

// Splash: the bunny alone, standing, on a transparent sheet (the splash color shows around it).
// The animated intro starts with the same bunny in the same place.
render(S, (c) => bunnyAt(c, 12, 12, 10, { mood: 'happy' }), 'splash-icon.png');

// Favicon: the icon, small.
{
  const surface = CK.MakeSurface(48, 48);
  const c = surface.getCanvas();
  const img = CK.MakeImageFromEncoded(iconBytes);
  c.drawImageRectOptions(img, CK.XYWHRect(0, 0, S, S), CK.XYWHRect(0, 0, 48, 48), CK.FilterMode.Linear, CK.MipmapMode.Linear, null);
  surface.flush();
  writeFileSync(path.join(root, 'assets', 'favicon.png'), surface.makeImageSnapshot().encodeToBytes());
  console.log('wrote assets/favicon.png');
}

// The bunny the app shows on screen: one picture per mood (pre-rendered, so screens show a plain
// image instead of re-drawing dozens of blurred layers), plus the bow on its own to be tinted with
// the year's color. Square 100-unit boxes, 6 px per unit; 'peek' is the top 68 units only.
for (const mood of ['happy', 'wave', 'sleepy', 'cheer', 'peek']) {
  render(BUDDY_PX, (c) => {
    c.scale(BUDDY_PX / 100, BUDDY_PX / 100);
    drawBunny(c, { mood, bow: null });
  }, `buddy/${mood}.png`, mood === 'peek' ? BUDDY_PX * 0.68 : BUDDY_PX);
}
render(BUDDY_PX, (c) => {
  c.scale(BUDDY_PX / 100, BUDDY_PX / 100);
  drawBow(c, C.white);
}, 'buddy/bow.png');
