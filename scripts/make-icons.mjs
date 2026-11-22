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

/** Small seeded random numbers, so the fur comes out the same on every run. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Soft fur on a shape: hundreds of tiny short strands combed outwards from (cx, cy), light ones where the
 * light falls and warm shaded ones below, plus a fine grain, all clipped to the shape. Subtle up close,
 * it makes the bunny read as plush instead of plastic.
 */
function fur(canvas, clip, { x, y, w, h, cx, cy, seed, count }) {
  const r = seeded(seed);
  canvas.save();
  canvas.clipPath(clip, CK.ClipOp.Intersect, true);
  const light = paint({ hex: C.white, alpha: 0.6, stroke: 0.3 });
  const dark = paint({ hex: C.shade, alpha: 0.24, stroke: 0.28 });
  for (let i = 0; i < count; i++) {
    const px = x + r() * w;
    const py = y + r() * h;
    // Combed away from the centre, with a little wander.
    const a = Math.atan2(py - cy, px - cx) + (r() - 0.5) * 0.9;
    const len = 0.9 + r() * 1.5;
    const bend = (r() - 0.5) * 0.8;
    const ex = px + Math.cos(a) * len;
    const ey = py + Math.sin(a) * len;
    const mx = (px + ex) / 2 - Math.sin(a) * bend;
    const my = (py + ey) / 2 + Math.cos(a) * bend;
    // Lit from the top left: strands up there catch the light, the rest sit in soft shade.
    const lit = (px - x) / w + (py - y) / h < 0.95 ? r() < 0.85 : r() < 0.45;
    canvas.drawPath(svg(`M ${px} ${py} Q ${mx} ${my} ${ex} ${ey}`), lit ? light : dark);
  }
  const grain = paint({ hex: C.shadow, alpha: 0.05 });
  for (let i = 0; i < count * 0.4; i++) canvas.drawCircle(x + r() * w, y + r() * h, 0.12 + r() * 0.12, grain);
  canvas.restore();
}

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
const TEAR = '#7CC4F2';
const MOUTH_DEEP = '#7A2E3E';
/** A trembling frown. */
const WOBBLE = svg('M45 69.4 Q 46.4 66.4 48 68 Q 50 66.2 52 68 Q 53.6 66.4 55 69.4');
const LITTLE_O = svg('M48.2 66.2 Q 50 70.4 51.8 66.2 Q 50 65.2 48.2 66.2 Z');
const WAIL_MOUTH = svg('M43.6 72.6 Q 50 62.4 56.4 72.6 Q 56 76.4 50 76.2 Q 44 76.4 43.6 72.6 Z');
const ZZZ_INK = '#9C8B7A';

const IRIS = '#5A3826';
const IRIS_DEEP = '#22140E';

/**
 * Open eyes, in one of a few styles (picked by EYES):
 *  'oval'   the first bunny: tall dark ovals with a dot of light.
 *  'glossy' big round eyes with a warm brown iris, a large highlight and a small sparkle, set a bit lower and closer.
 *  'bead'   small shiny bead eyes set wide apart, like a plush toy.
 */
function drawEyes(canvas, style, size = 1) {
  if (style === 'oval') {
    for (const x of [37, 55.4]) {
      oval(canvas, x, 53.4, 7.6, 9, paint({ hex: C.face }));
      canvas.drawCircle(x + 2.5, 56, 1.9, paint({ hex: C.white }));
      canvas.drawCircle(x + 5.2, 60, 0.9, paint({ hex: C.white, alpha: 0.8 }));
    }
    return;
  }
  if (style === 'bead') {
    for (const cx of [38.6, 61.4]) {
      canvas.drawCircle(cx, 59, 3.1, paint({ hex: C.face }));
      canvas.drawCircle(cx - 1, 57.9, 1.05, paint({ hex: C.white }));
    }
    return;
  }
  // glossy
  for (const cx of [40.2, 59.8]) {
    const cy = 58.6;
    const r = 4.5 * size;
    canvas.drawCircle(cx, cy, r + 0.45, paint({ hex: IRIS_DEEP }));
    const iris = paint();
    iris.setShader(CK.Shader.MakeRadialGradient([cx, cy + 1.6], r, [color('#8A5A3C'), color(IRIS), color(IRIS_DEEP)], [0, 0.55, 1], CK.TileMode.Clamp));
    canvas.drawCircle(cx, cy, r, iris);
    canvas.drawCircle(cx, cy - 0.3, r * 0.48, paint({ hex: IRIS_DEEP, alpha: 0.85 }));
    oval(canvas, cx - 3.1 * size, cy - 3.6 * size, 3.6 * size, 3.1 * size, paint({ hex: C.white }));
    canvas.drawCircle(cx + 1.9 * size, cy + 2 * size, 0.95 * size, paint({ hex: C.white, alpha: 0.9 }));
    // Bigger eyes are pleading: a second, wetter glint.
    if (size > 1) canvas.drawCircle(cx - 2 * size, cy + 1.6 * size, 0.7 * size, paint({ hex: C.white, alpha: 0.7 }));
    // A soft line of light along the lower lid.
    canvas.drawPath(svg(`M ${cx - 2.6} ${cy + 3.4} Q ${cx} ${cy + 4.6} ${cx + 2.6} ${cy + 3.4}`), paint({ hex: C.white, alpha: 0.35, stroke: 0.6 }));
  }
}

/** The eye style the app uses. */
const EYES = process.env.EYES ?? 'glossy';

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
function drawBunny(canvas, { mood = 'happy', bow = C.coral, mono = false, eyes = EYES, blink = false } = {}) {
  const waving = mood === 'wave';
  const cheering = mood === 'cheer';
  const sleeping = mood === 'sleepy';
  const peek = mood === 'peek';
  // The app icon's moods while today's page stays empty, getting more dramatic (like a pet that misses you):
  // 'plead' huge sparkly puppy eyes and clasped paws, 'cry' tears streaming down, 'wail' sobbing with
  // tear fountains into a puddle.
  const pleading = mood === 'plead';
  const crying = mood === 'cry';
  const wailing = mood === 'wail';
  const sad = crying || wailing;
  // Clasped paws in front replace the arms at the sides; wailing throws both arms up.
  const sideArms = !peek && !pleading;
  const earL = sleeping || sad ? -68 : pleading ? -38 : cheering ? -16 : -9;
  const earR = sleeping || sad ? 68 : pleading ? 38 : waving ? 24 : cheering ? 16 : 9;

  const silhouette = (p) => {
    if (!peek) {
      canvas.drawCircle(81, 77, 6.5, p);
      oval(canvas, 27, 83, 20, 11, p);
      oval(canvas, 53, 83, 20, 11, p);
    }
    rotated(canvas, earL, 38, 38, () => oval(canvas, 30, 3, 15, 38, p));
    rotated(canvas, earR, 62, 38, () => oval(canvas, 55, 3, 15, 38, p));
    if (cheering || wailing) rotated(canvas, -28, 15, 43, () => oval(canvas, 9, 33, 12, 20, p));
    else if (sideArms) rotated(canvas, 16, 17, 65.5, () => oval(canvas, 11, 56, 12, 19, p));
    canvas.drawPath(BODY, p);
    if (waving || cheering || wailing) rotated(canvas, 28, 85, 43, () => oval(canvas, 79, 33, 12, 20, p));
    else if (sideArms) rotated(canvas, -16, 83, 65.5, () => oval(canvas, 77, 56, 12, 19, p));
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

  if (wailing) {
    // Sitting in a puddle of its own tears.
    oval(canvas, 6, 84, 88, 15, paint({ hex: TEAR, alpha: 0.55 }));
    oval(canvas, 14, 86.5, 30, 4, paint({ hex: C.white, alpha: 0.5, blur: 1 }));
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
      const limbPath = new CK.PathBuilder().addOval(CK.XYWHRect(x, y, w, h)).detachAndDelete();
      fur(canvas, limbPath, { x, y, w, h, cx: x + w / 2, cy: y + h / 2, seed: Math.round(x * 13 + y), count: Math.round(w * h * 0.2) });
    });
  if (!peek) {
    canvas.drawCircle(81, 77, 6.5, radial(79, 74, 9, FUR, [0, 0.5, 1]));
    limb(27, 83, 20, 11);
    limb(53, 83, 20, 11);
  }
  const ear = (deg, x, px) =>
    rotated(canvas, deg, px, 38, () => {
      oval(canvas, x, 3, 15, 38, radial(x + 5, 12, 30, FUR, [0, 0.4, 1]));
      const earPath = new CK.PathBuilder().addOval(CK.XYWHRect(x, 3, 15, 38)).detachAndDelete();
      fur(canvas, earPath, { x, y: 3, w: 15, h: 38, cx: x + 7.5, cy: 30, seed: Math.round(x * 7), count: 110 });
      oval(canvas, x + 4, 9, 7, 25, paint({ hex: C.ear, blur: 1 }));
    });
  ear(earL, 30, 38);
  ear(earR, 55, 62);
  if (cheering || wailing) limb(9, 33, 12, 20, -28);
  else if (sideArms) limb(11, 56, 12, 19, 16);

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
  fur(canvas, BODY, { x: 16, y: 31, w: 68, h: 60, cx: 50, cy: 58, seed: 1907, count: 620 });
  // A little curl of fur on top of the head, between the ears.
  canvas.drawPath(svg('M47.6 33.2 Q 48.4 28.6 51.6 29.2 Q 53.4 29.8 52.4 31.4'), paint({ hex: C.shade, alpha: 0.9, stroke: 1.1 }));
  canvas.drawPath(svg('M47.9 32.8 Q 48.7 29.4 51.3 29.8'), paint({ hex: C.white, alpha: 0.9, stroke: 0.55 }));

  if (bow) {
    drawBow(canvas, bow);
    canvas.drawCircle(60.3, 32.8, 0.8, paint({ hex: C.white, alpha: 0.7 }));
  }

  // Cheeks and face (flushed when upset).
  const blush = pleading || sad ? 0.85 : 0.6;
  oval(canvas, 23.5, 62, 14, 8.5, paint({ hex: C.blush, alpha: blush, blur: 2.6 }));
  oval(canvas, 62.5, 62, 14, 8.5, paint({ hex: C.blush, alpha: blush, blur: 2.6 }));
  if (sleeping) {
    canvas.drawPath(EYE_SHUT_L, paint({ hex: C.face, stroke: 2.2 }));
    canvas.drawPath(EYE_SHUT_R, paint({ hex: C.face, stroke: 2.2 }));
  } else if (cheering) {
    canvas.drawPath(EYE_JOY_L, paint({ hex: C.face, stroke: 2.4 }));
    canvas.drawPath(EYE_JOY_R, paint({ hex: C.face, stroke: 2.4 }));
  } else if (wailing) {
    // Squeezed shut: > <
    canvas.drawPath(svg('M36.4 54.8 L 43.4 58.6 L 36.4 62.4 M63.6 54.8 L 56.6 58.6 L 63.6 62.4'), paint({ hex: C.face, stroke: 2.6 }));
  } else if (blink) {
    // Mid-blink: soft closed lids with a tiny flick of lashes at the outer corners.
    canvas.drawPath(EYE_SHUT_L, paint({ hex: C.face, stroke: 2.2 }));
    canvas.drawPath(EYE_SHUT_R, paint({ hex: C.face, stroke: 2.2 }));
    canvas.drawPath(svg('M36.9 58.8 L 35.2 57.6 M63.1 58.8 L 64.8 57.6'), paint({ hex: C.face, stroke: 1.2 }));
  } else {
    drawEyes(canvas, eyes, pleading ? 1.5 : crying ? 1.3 : 1);
  }
  if (pleading || sad) {
    // Worried brows, steeply raised towards the middle.
    const brows = wailing ? 'M34.4 51.6 Q 38.6 46.8 44.6 46.2 M55.4 46.2 Q 61.4 46.8 65.6 51.6' : 'M33.6 50.6 Q 38 45.2 44.4 45.6 M55.6 45.6 Q 62 45.2 66.4 50.6';
    canvas.drawPath(svg(brows), paint({ hex: C.face, alpha: 0.8, stroke: 1.5 }));
  }
  if (crying) {
    // Two streams of tears running from the eyes down the cheeks.
    for (const x of [40.2, 59.8]) {
      const s = x < 50 ? -1 : 1;
      const d = `M ${x - 2.6} 62.8 Q ${x - 3.4 + s * 1.5} 75 ${x - 3.6 + s * 2.5} 86 Q ${x + s * 2.5} 89.6 ${x + 3.6 + s * 2.5} 86 Q ${x + 3.4 + s * 1.5} 75 ${x + 2.6} 62.8 Z`;
      canvas.drawPath(svg(d), paint({ hex: TEAR, alpha: 0.9 }));
      canvas.drawPath(svg(`M ${x - 1} 66 Q ${x - 1.4 + s} 74 ${x - 1.2 + s * 2} 83`), paint({ hex: C.white, alpha: 0.75, stroke: 0.9 }));
    }
  }
  if (wailing) {
    // Tears spraying out sideways in arcs, with drops flying.
    const jet = paint({ hex: TEAR, stroke: 3.6 });
    canvas.drawPath(svg('M35 58 Q 22 46 9 58'), jet);
    canvas.drawPath(svg('M65 58 Q 78 46 91 58'), jet);
    for (const [x, y, r] of [[7, 63, 2], [4, 69, 1.4], [93, 63, 2], [96, 69, 1.4], [13, 52, 1.1], [87, 52, 1.1]]) {
      canvas.drawCircle(x, y, r, paint({ hex: TEAR }));
    }
    canvas.drawPath(svg('M33 54 Q 22 44 12 54'), paint({ hex: C.white, alpha: 0.55, stroke: 0.9 }));
    canvas.drawPath(svg('M67 54 Q 78 44 88 54'), paint({ hex: C.white, alpha: 0.55, stroke: 0.9 }));
  }
  oval(canvas, 47.9, 62.3, 4.2, 3, paint({ hex: C.nose }));
  if (cheering) canvas.drawPath(OPEN_MOUTH, paint({ hex: MOUTH }));
  else if (wailing) {
    // Mouth wide open, mid-sob.
    canvas.drawPath(WAIL_MOUTH, paint({ hex: MOUTH_DEEP }));
    oval(canvas, 46.6, 72.4, 6.8, 3.4, paint({ hex: C.blush }));
  } else if (crying) canvas.drawPath(WOBBLE, paint({ hex: C.face, stroke: 1.5 }));
  else if (pleading) canvas.drawPath(LITTLE_O, paint({ hex: MOUTH }));
  else canvas.drawPath(SMILE, paint({ hex: C.face, stroke: 1.5 }));

  // Front arm, two paws clasped under the chin, or two paws gripping the edge.
  if (waving || cheering || wailing) limb(79, 33, 12, 20, 28);
  else if (sideArms) limb(77, 56, 12, 19, -16);
  if (pleading) {
    limb(38.5, 70, 11, 15, 14);
    limb(50.5, 70, 11, 15, -14);
  }
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

// PREVIEW=/path/sheet.png: draw every eye style side by side (happy + wave) and stop, writing nothing to assets.
if (process.env.PREVIEW) {
  const moods = ['wave', 'plead', 'cry', 'wail', 'cheer', 'happy'];
  const cell = 400;
  const surface = CK.MakeSurface(cell * 3, cell * 2);
  const c = surface.getCanvas();
  c.clear(color(C.paper));
  moods.forEach((mood, i) => bunnyAt(c, (i % 3) * cell + 20, Math.floor(i / 3) * cell + 20, 3.6, { mood }));
  surface.flush();
  writeFileSync(process.env.PREVIEW, surface.makeImageSnapshot().encodeToBytes());
  console.log('wrote ' + process.env.PREVIEW);
  process.exit(0);
}

// STORE=/dir: the Google Play feature graphic (1024×500) and stop, writing nothing to assets.
if (process.env.STORE) {
  const W = 1024;
  const H = 500;
  const surface = CK.MakeSurface(W, H);
  const c = surface.getCanvas();
  c.clear(color(C.paper));
  const gap = 32;
  const dot = paint({ hex: C.dots, alpha: 0.45 });
  for (let x = gap / 2; x < W; x += gap) for (let y = gap / 2; y < H; y += gap) c.drawCircle(x, y, 2.6, dot);
  c.drawRect(CK.XYWHRect(56, 0, 5, H), paint({ hex: C.margin, alpha: 0.55 }));
  const v = paint();
  v.setShader(CK.Shader.MakeRadialGradient([W / 2, H * 0.42], W * 0.62, [color(C.shadow, 0), color(C.shadow, 0), color(C.shadow, 0.14)], [0, 0.6, 1], CK.TileMode.Clamp));
  c.drawRect(CK.XYWHRect(0, 0, W, H), v);

  // Two taped polaroids behind the bunny, like memories pinned to the page.
  const polaroid = (x, y, w, deg, tint) =>
    rotated(c, deg, x + w / 2, y + w * 0.6, () => {
      c.drawRRect(CK.RRectXY(CK.XYWHRect(x + 4, y + 8, w, w * 1.2), 6, 6), paint({ hex: C.shadow, alpha: 0.18, blur: 8 }));
      c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, w, w * 1.2), 6, 6), paint({ hex: C.white }));
      const pic = paint();
      pic.setShader(CK.Shader.MakeLinearGradient([x, y], [x, y + w], [color(tint, 0.55), color(C.highlight, 0.35)], null, CK.TileMode.Clamp));
      c.drawRect(CK.XYWHRect(x + w * 0.07, y + w * 0.07, w * 0.86, w * 0.86), pic);
      c.drawRect(CK.XYWHRect(x + w * 0.3, y - 10, w * 0.4, 22), paint({ hex: tint, alpha: 0.7 }));
    });
  polaroid(600, 92, 170, -9, '#6FB59B');
  polaroid(770, 70, 170, 7, C.coral);

  bunnyAt(c, 640, 150, 3.4, { mood: 'wave', bow: C.coral });

  drawName(c, 300, 230, 150);
  const tagFont = new CK.Font(caveat, 52);
  const lines = ['one tiny moment a day,', 'back to you next year'];
  lines.forEach((line, i) => {
    const w = tagFont.getGlyphWidths(tagFont.getGlyphIDs(line)).reduce((a, b) => a + b, 0);
    c.drawText(line, 300 - w / 2, 320 + i * 60, paint({ hex: C.ink, alpha: 0.78 }), tagFont);
    // Caveat has no flower glyph: a little drawn heart ends the line instead.
    if (i === lines.length - 1) {
      const hx = 300 + w / 2 + 14;
      const hy = 320 + i * 60 - 30;
      const heart = svg(`M ${hx + 14} ${hy + 28} C ${hx - 6} ${hy + 14}, ${hx - 2} ${hy - 4}, ${hx + 14} ${hy + 6} C ${hx + 30} ${hy - 4}, ${hx + 34} ${hy + 14}, ${hx + 14} ${hy + 28} Z`);
      c.drawPath(heart, paint({ hex: C.coral }));
    }
  });
  surface.flush();
  const out = path.join(process.env.STORE, 'feature-graphic-1024x500.png');
  writeFileSync(out, surface.makeImageSnapshot().encodeToBytes());
  console.log('wrote ' + out);
  process.exit(0);
}

// ─── The leather diary (2026-11): the icon, splash and notification pictures are the gilt mixtape stamp on leather ───
// Same values as src/theme/papers.ts (green leather) and tokens.ts (gilt, wax).
const L = {
  leather: '#1F3A2E',
  leatherNight: '#14261D',
  giltBright: '#E3C27C',
  gilt: '#C9A45C',
  giltDeep: '#8E6F33',
  tarnishBright: '#B5A27A',
  tarnish: '#8C7A55',
  tarnishDeep: '#5E5238',
  wax: '#8E2A20',
  page: '#EFE4CC',
  ink: '#2A2118',
  inkBlue: '#23304A',
  sepia: '#6B2A22',
  white: '#FFFFFF',
  black: '#000000',
};
const cormorant = CK.Typeface.MakeTypefaceFromData(
  readFileSync(path.join(root, 'node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf')).buffer,
);
const fell = CK.Typeface.MakeTypefaceFromData(
  readFileSync(path.join(root, 'node_modules/@expo-google-fonts/im-fell-english/400Regular_Italic/IMFellEnglish_400Regular_Italic.ttf')).buffer,
);

/** Pebbled leather with a sheen from the top left and darker edges; optionally gilt stitching inside its edge. */
function leather(canvas, w, h = w, { stitch = false, base = L.leather, radius = 0 } = {}) {
  canvas.clear(color(base));
  const grain = paint({ alpha: 0.16 });
  grain.setShader(CK.Shader.MakeFractalNoise(0.18, 0.18, 2, 7, 0, 0));
  grain.setBlendMode(CK.BlendMode.Overlay);
  canvas.drawRect(CK.XYWHRect(0, 0, w, h), grain);
  const mottle = paint({ alpha: 0.22 });
  mottle.setShader(CK.Shader.MakeFractalNoise(0.004, 0.004, 2, 3, 0, 0));
  mottle.setBlendMode(CK.BlendMode.Multiply);
  canvas.drawRect(CK.XYWHRect(0, 0, w, h), mottle);
  const sheen = paint();
  sheen.setShader(CK.Shader.MakeRadialGradient([w * 0.3, h * 0.16], Math.max(w, h) * 0.75, [color(L.white, 0.09), color(L.white, 0)], [0, 1], CK.TileMode.Clamp));
  canvas.drawRect(CK.XYWHRect(0, 0, w, h), sheen);
  const edge = paint();
  edge.setShader(CK.Shader.MakeRadialGradient([w / 2, h * 0.46], Math.max(w, h) * 0.78, [color(L.black, 0), color(L.black, 0), color(L.black, 0.42)], [0, 0.5, 1], CK.TileMode.Clamp));
  canvas.drawRect(CK.XYWHRect(0, 0, w, h), edge);
  if (stitch) {
    const inset = w * 0.07;
    const dash = paint({ hex: L.gilt, alpha: 0.5, stroke: w * 0.006 });
    dash.setPathEffect(CK.PathEffect.MakeDash([w * 0.022, w * 0.016], 0));
    canvas.drawRRect(CK.RRectXY(CK.XYWHRect(inset, inset, w - inset * 2, h - inset * 2), radius || w * 0.16, radius || w * 0.16), dash);
    const groove = paint({ hex: L.black, alpha: 0.3, stroke: w * 0.003 });
    const g = inset - w * 0.012;
    canvas.drawRRect(CK.RRectXY(CK.XYWHRect(g, g, w - g * 2, h - g * 2), (radius || w * 0.16) + w * 0.012, (radius || w * 0.16) + w * 0.012), groove);
  }
}

/** Gold for the tooling: a lit gradient across the stamp (dulled when tarnished), or flat white for silhouettes. */
function goldPaint(cx, cy, r, { mono = false, tarnished = false, stroke = 0 } = {}) {
  const p = paint({ hex: L.white, stroke });
  if (mono) return p;
  const [a, b, c] = tarnished ? [L.tarnishBright, L.tarnish, L.tarnishDeep] : [L.giltBright, L.gilt, L.giltDeep];
  p.setShader(CK.Shader.MakeLinearGradient([cx - r, cy - r], [cx + r, cy + r], [color(a), color(b), color(c)], [0, 0.5, 1], CK.TileMode.Clamp));
  return p;
}

/**
 * The diary's stamp (as drawn in the app, src/components/scrapbook/Buddy.tsx): two tooled rings with LOOKBACK
 * around the top, two small diamonds, and a mixtape at its heart. `state` gives the icon its quiet moods:
 * waiting = a red record light on the cassette; missed = the gold dulled; gone = tarnished, tape spilling out.
 */
function stamp(canvas, cx, cy, r, { state = 'default', mono = false, pressed = true } = {}) {
  const u = r / 50;
  const tarnished = state === 'missed' || state === 'gone';
  const g = (stroke = 0) => goldPaint(cx, cy, r, { mono, tarnished, stroke: stroke * u });
  const at = (x, y) => [cx + (x - 50) * u, cy + (y - 50) * u];
  if (pressed && !mono) canvas.drawCircle(cx, cy, 48 * u, paint({ hex: L.black, alpha: 0.22 }));
  canvas.drawCircle(cx, cy, 48 * u, g(1.8));
  canvas.drawCircle(cx, cy, 45.4 * u, g(0.6));
  canvas.drawCircle(cx, cy, 34.5 * u, g(1.1));

  // LOOKBACK, one letter at a time along the arc over the top, each standing on it.
  const word = 'LOOKBACK';
  const font = new CK.Font(cormorant, 8.6 * u);
  const ids = font.getGlyphIDs(word);
  const widths = font.getGlyphWidths(ids);
  const spacing = 1.9 * u;
  const total = widths.reduce((s, w) => s + w, 0) + spacing * (word.length - 1);
  const arcR = 38.2 * u;
  let along = -total / 2;
  const fill = g();
  for (let i = 0; i < word.length; i++) {
    const w = widths[i];
    const mid = along + w / 2;
    const angle = mid / arcR; // radians from straight up
    canvas.save();
    canvas.translate(cx + Math.sin(angle) * arcR, cy - Math.cos(angle) * arcR);
    canvas.rotate((angle * 180) / Math.PI, 0, 0);
    canvas.drawText(word[i], -w / 2, 0, fill, font);
    canvas.restore();
    along += w + spacing;
  }
  // Two diamonds at nine and three o'clock.
  for (const x of [10.4, 89.6]) {
    const [dx, dy] = at(x, 50);
    canvas.drawPath(svg(`M ${dx - 2.2 * u} ${dy} L ${dx} ${dy - 2.2 * u} L ${dx + 2.2 * u} ${dy} L ${dx} ${dy + 2.2 * u} Z`), fill);
  }

  // The mixtape.
  const [sx, sy] = at(29, 37.5);
  canvas.drawRRect(CK.RRectXY(CK.XYWHRect(sx, sy, 42 * u, 26 * u), 2.6 * u, 2.6 * u), g(1.5));
  const [lx, ly] = at(32.5, 40.5);
  const label = goldPaint(cx, cy, r, { mono, tarnished });
  label.setAlphaf(mono ? 1 : 0.22);
  if (!mono) canvas.drawRect(CK.XYWHRect(lx, ly, 35 * u, 7.5 * u), label);
  canvas.drawRect(CK.XYWHRect(lx, ly, 35 * u, 7.5 * u), g(0.6));
  const [l1x, l1y] = at(35, 44.2);
  canvas.drawLine(l1x, l1y, l1x + 23 * u, l1y, g(0.7));
  const [wx, wy] = at(39, 51);
  canvas.drawRect(CK.XYWHRect(wx, wy, 22 * u, 6.5 * u), g(0.8));
  for (const x of [41.6, 58.4]) {
    const [rx, ry] = at(x, 54.2);
    if (!mono) canvas.drawCircle(rx, ry, 3.6 * u, paint({ hex: L.black, alpha: 0.35 }));
    canvas.drawCircle(rx, ry, 3.6 * u, g(1.1));
    canvas.drawLine(rx, ry - 2.2 * u, rx, ry + 2.2 * u, g(0.6));
    canvas.drawLine(rx - 2.2 * u, ry, rx + 2.2 * u, ry, g(0.6));
  }
  const [f1x, f1y] = at(37, 63.5);
  canvas.drawPath(svg(`M ${f1x} ${f1y} L ${f1x + 2.5 * u} ${f1y - 3.7 * u} L ${f1x + 23.5 * u} ${f1y - 3.7 * u} L ${f1x + 26 * u} ${f1y}`), g(0.9));

  if (state === 'waiting' && !mono) {
    // A red record light on the label: today's page is still empty.
    const [rx, ry] = at(64.2, 44.2);
    canvas.drawCircle(rx, ry, 2.6 * u, paint({ hex: L.wax }));
    canvas.drawCircle(rx, ry, 2.6 * u, g(0.5));
    canvas.drawCircle(rx - 0.8 * u, ry - 0.8 * u, 0.8 * u, paint({ hex: L.white, alpha: 0.45 }));
  }
  if (state === 'gone') {
    // Tape spilling out of the cassette in a loose loop.
    const [tx, ty] = at(47, 57.5);
    canvas.drawPath(
      svg(`M ${tx} ${ty} C ${tx - 4 * u} ${ty + 9 * u} ${tx + 1 * u} ${ty + 15 * u} ${tx + 6 * u} ${ty + 11 * u} C ${tx + 10 * u} ${ty + 8 * u} ${tx + 4 * u} ${ty + 4 * u} ${tx + 9 * u} ${ty + 1 * u}`),
      g(0.8),
    );
  }
}

/** The icon's backdrop: warm paper on a desk, lit from the top left, with fine grain. */
function iconBackdrop(canvas, size) {
  canvas.clear(color('#E9DEC6'));
  const g = paint();
  g.setShader(CK.Shader.MakeRadialGradient([size * 0.35, size * 0.28], size * 0.95, [color('#FAF3E3'), color('#E4D6B9'), color('#B9A27A')], [0, 0.55, 1], CK.TileMode.Clamp));
  canvas.drawRect(CK.XYWHRect(0, 0, size, size), g);
  const grain = paint({ alpha: 0.12 });
  grain.setShader(CK.Shader.MakeFractalNoise(0.9, 0.9, 3, 5, 0, 0));
  grain.setBlendMode(CK.BlendMode.Multiply);
  canvas.drawRect(CK.XYWHRect(0, 0, size, size), grain);
}

/** Points along a cubic bezier. */
function bezier(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}
/** Crinkles a line of points sideways (tape that has been pulled and creased), seeded. */
function crinkle(points, amp, rnd) {
  return points.map(([x, y], i) => {
    if (i === 0 || i === points.length - 1) return [x, y];
    const [px, py] = points[i - 1];
    const dx = x - px, dy = y - py;
    const len = Math.hypot(dx, dy) || 1;
    const k = (rnd() - 0.5) * 2 * amp;
    return [x - (dy / len) * k, y + (dx / len) * k];
  });
}
const pathOf = (pts) => {
  // A smooth line through the points (quadratic curves through their midpoints), so tape bends rather than kinks.
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q ${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return svg(d + ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`);
};

/**
 * A length of magnetic tape: a brown ribbon with its dark edge, a satin sheen down one side, and glints where it
 * twists. `width` in px.
 */
function tapeStrand(canvas, pts, width, rnd) {
  const p = pathOf(pts);
  canvas.drawPath(p, paint({ hex: '#000000', alpha: 0.28, stroke: width * 1.6, blur: width * 0.9 }));
  canvas.drawPath(p, paint({ hex: '#1E1009', stroke: width * 1.15 }));
  canvas.drawPath(p, paint({ hex: rnd() < 0.5 ? '#4A2C1B' : '#3F2516', stroke: width }));
  // The shiny side catching the light, broken where the tape twists.
  const sheen = paint({ hex: '#B48A62', alpha: 0.55, stroke: width * 0.22 });
  sheen.setPathEffect(CK.PathEffect.MakeDash([width * (3 + rnd() * 6), width * (1 + rnd() * 3)], rnd() * width * 5));
  canvas.drawPath(p, sheen);
}

/** A crack in the plastic: a dark split with a pale, stress-whitened lip along it. */
function crack(canvas, pts, u) {
  const p = pathOf(pts);
  canvas.drawPath(p, paint({ hex: '#E8E8EC', alpha: 0.35, stroke: 1.6 * u, blur: 0.6 * u }));
  canvas.drawPath(p, paint({ hex: '#050505', stroke: 0.55 * u }));
  canvas.drawPath(p, paint({ hex: '#CFCFD4', alpha: 0.7, stroke: 0.25 * u }));
}

/** A Phillips screw set into the shell. */
function screwHead(canvas, cx, cy, r) {
  canvas.drawCircle(cx, cy, r * 1.15, paint({ hex: '#000000', alpha: 0.6 }));
  const g = paint();
  g.setShader(CK.Shader.MakeRadialGradient([cx - r * 0.35, cy - r * 0.35], r * 1.4, [color('#D9D9DD'), color('#8C8C92'), color('#4A4A50')], [0, 0.55, 1], CK.TileMode.Clamp));
  canvas.drawCircle(cx, cy, r, g);
  const slot = paint({ hex: '#2A2A2E', stroke: r * 0.28 });
  canvas.drawLine(cx - r * 0.6, cy, cx + r * 0.6, cy, slot);
  canvas.drawLine(cx, cy - r * 0.6, cx, cy + r * 0.6, slot);
}

/**
 * A realistic 90s compact cassette on a 100 × 63 grid at `scale` px per unit, top-left at (x, y): smoky black plastic
 * with grain, bevelled edges and a soft sheen; a paper label with a printed "A" box and lines, the title in blue
 * ballpoint; a clear window onto the wound tape packs and toothed white hubs; the printed band; the foot with its holes;
 * Phillips screws; a soft shadow on the desk. `state`: 'default'; 'waiting' (a twist of tape pulled out, "today?" on
 * the label); 'missed' (a cracked shell, a crinkled loop of tape hanging out); 'gone' (split in two, the tape pulled out
 * into a tangled nest all round it). `mono` draws a plain silhouette.
 */
function cassette(canvas, x, y, scale, { state = 'default', mono = false, size = S } = {}) {
  const u = scale;
  const at = (px, py) => [x + px * u, y + py * u];
  const R = (px, py, w, h) => CK.XYWHRect(x + px * u, y + py * u, w * u, h * u);
  const rnd = seeded(state === 'gone' ? 41 : state === 'missed' ? 23 : 7);

  if (mono) {
    canvas.drawRRect(CK.RRectXY(R(0, 0, 100, 63), 3 * u, 3 * u), paint({ hex: '#FFFFFF' }));
    const cut = paint();
    cut.setBlendMode(CK.BlendMode.Clear);
    for (const hx of [29, 71]) canvas.drawCircle(...at(hx, 31), 7.5 * u, cut);
    canvas.drawRect(R(41, 25, 18, 12), cut);
    return;
  }

  // The tangled nest: half of it drawn behind the cassette, half in front, so it wraps round it.
  const nest = [];
  if (state === 'gone') {
    const cx = x + 50 * u, cy = y + 40 * u;
    for (let i = 0; i < 34; i++) {
      const ang = rnd() * Math.PI * 2;
      const r1 = size * (0.12 + rnd() * 0.34);
      const r2 = size * (0.12 + rnd() * 0.34);
      const a2 = ang + (rnd() - 0.5) * 2.6;
      const p0 = [cx + Math.cos(ang) * r1 * 0.3, cy + Math.sin(ang) * r1 * 0.3];
      const p3 = [cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2 * 0.85];
      const p1 = [cx + (rnd() - 0.5) * size * 0.9, cy + (rnd() - 0.5) * size * 0.8];
      const p2 = [cx + (rnd() - 0.5) * size * 0.9, cy + (rnd() - 0.5) * size * 0.8];
      nest.push({ pts: crinkle(bezier(p0, p1, p2, p3, 22), size * 0.0025, rnd), w: size * (0.012 + rnd() * 0.008), front: rnd() < 0.45 });
    }
    for (const s of nest) if (!s.front) tapeStrand(canvas, s.pts, s.w, rnd);
  }

  const broken = state === 'gone';
  const pieces = broken
    ? [
        { clip: svg(`M ${x - 4 * u} ${y - 4 * u} L ${x + 56 * u} ${y - 4 * u} L ${x + 50 * u} ${y + 20 * u} L ${x + 58 * u} ${y + 38 * u} L ${x + 48 * u} ${y + 70 * u} L ${x - 4 * u} ${y + 70 * u} Z`), dx: -4, dy: 3, rot: -6 },
        { clip: svg(`M ${x + 56 * u} ${y - 4 * u} L ${x + 106 * u} ${y - 4 * u} L ${x + 106 * u} ${y + 70 * u} L ${x + 48 * u} ${y + 70 * u} L ${x + 58 * u} ${y + 38 * u} L ${x + 50 * u} ${y + 20 * u} Z`), dx: 7, dy: 8, rot: 9 },
      ]
    : [{ clip: null, dx: 0, dy: 0, rot: 0 }];

  // A soft shadow on the desk.
  canvas.drawRRect(CK.RRectXY(R(2, 4, 100, 63), 4 * u, 4 * u), paint({ hex: '#2A1E10', alpha: 0.45, blur: 5 * u }));

  for (const piece of pieces) {
    canvas.save();
    if (piece.clip) {
      canvas.translate(piece.dx * u, piece.dy * u);
      canvas.rotate(piece.rot, x + 50 * u, y + 31 * u);
      canvas.clipPath(piece.clip, CK.ClipOp.Intersect, true);
    }
    const body = CK.RRectXY(R(0, 0, 100, 63), 3 * u, 3 * u);
    // Smoky black plastic, lit from above.
    const shell = paint();
    shell.setShader(CK.Shader.MakeLinearGradient(at(0, 0), at(0, 63), [color('#3A3A3E'), color('#1E1E21'), color('#141416'), color('#0C0C0D')], [0, 0.25, 0.7, 1], CK.TileMode.Clamp));
    canvas.drawRRect(body, shell);
    canvas.save();
    canvas.clipRRect(body, CK.ClipOp.Intersect, true);
    const grain = paint({ alpha: 0.18 });
    grain.setShader(CK.Shader.MakeFractalNoise(1.2, 1.2, 2, 11, 0, 0));
    grain.setBlendMode(CK.BlendMode.Overlay);
    canvas.drawRRect(body, grain);
    // The moulded ridge round the face, and the recessed panel inside it.
    canvas.drawRRect(CK.RRectXY(R(2.2, 2.2, 95.6, 58.6), 2 * u, 2 * u), paint({ hex: '#000000', alpha: 0.55, stroke: 0.7 * u }));
    canvas.drawRRect(CK.RRectXY(R(2.8, 2.8, 94.4, 57.4), 2 * u, 2 * u), paint({ hex: '#FFFFFF', alpha: 0.08, stroke: 0.5 * u }));
    canvas.restore();
    // Bevelled outer edge: bright along the top, dark along the bottom.
    const bevel = paint({ stroke: 0.9 * u });
    bevel.setShader(CK.Shader.MakeLinearGradient(at(0, 0), at(0, 63), [color('#8A8A92', 0.9), color('#2A2A2E', 0.6), color('#000000', 0.9)], [0, 0.5, 1], CK.TileMode.Clamp));
    canvas.drawRRect(body, bevel);

    // The window and what shows through it: wound tape packs and the toothed hubs.
    const win = CK.RRectXY(R(15, 19.5, 70, 23), 2 * u, 2 * u);
    canvas.drawRRect(win, paint({ hex: '#101012' }));
    canvas.save();
    canvas.clipRRect(win, CK.ClipOp.Intersect, true);
    const played = state === 'default' || state === 'waiting' ? 0.35 : 0.55;
    for (const [hx, amt] of [[29, 1 - played], [71, played]]) {
      const [cx, cy] = at(hx, 31);
      const r = (8.5 + amt * 9) * u;
      const pack = paint();
      pack.setShader(CK.Shader.MakeRadialGradient([cx, cy], r, [color('#2A1A10'), color('#4E3121'), color('#3A2416')], [0.3, 0.8, 1], CK.TileMode.Clamp));
      canvas.drawCircle(cx, cy, r, pack);
      for (let k = 9; k < r / u; k += 1.2) canvas.drawCircle(cx, cy, k * u, paint({ hex: '#000000', alpha: 0.12, stroke: 0.2 * u }));
      canvas.drawCircle(cx, cy, r, paint({ hex: '#8C6A4C', alpha: 0.35, stroke: 0.3 * u }));
    }
    // The tape running across between the packs, and the guide.
    canvas.drawRect(R(15, 39.5, 70, 1.6), paint({ hex: '#3A2416' }));
    canvas.restore();
    for (const hx of [29, 71]) {
      const [cx, cy] = at(hx, 31);
      const hub = paint();
      hub.setShader(CK.Shader.MakeRadialGradient([cx - 2 * u, cy - 2 * u], 9 * u, [color('#FFFFFF'), color('#E6E6E3'), color('#B9B9B6')], [0, 0.6, 1], CK.TileMode.Clamp));
      canvas.drawCircle(cx, cy, 7 * u, hub);
      canvas.drawCircle(cx, cy, 7 * u, paint({ hex: '#000000', alpha: 0.25, stroke: 0.35 * u }));
      canvas.drawCircle(cx, cy, 3.4 * u, paint({ hex: '#1A1A1C' }));
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        canvas.drawLine(cx + Math.cos(a) * 1.8 * u, cy + Math.sin(a) * 1.8 * u, cx + Math.cos(a) * 3.4 * u, cy + Math.sin(a) * 3.4 * u, paint({ hex: '#F2F2F0', stroke: 0.9 * u }));
      }
    }
    // The clear window pane: a reflection across it.
    const glare = paint();
    glare.setShader(CK.Shader.MakeLinearGradient(at(15, 19.5), at(85, 42.5), [color('#FFFFFF', 0.16), color('#FFFFFF', 0.02), color('#FFFFFF', 0.1), color('#FFFFFF', 0)], [0, 0.35, 0.5, 1], CK.TileMode.Clamp));
    canvas.drawRRect(win, glare);
    canvas.drawRRect(win, paint({ hex: '#5A5A60', alpha: 0.7, stroke: 0.5 * u }));

    // The paper label: printed "A" box and rules, the title in blue ballpoint.
    const label = CK.RRectXY(R(6, 3.5, 88, 14.5), 1 * u, 1 * u);
    const paper = paint();
    paper.setShader(CK.Shader.MakeLinearGradient(at(0, 3.5), at(0, 18), [color('#F7F3EA'), color('#E9E3D5')], [0, 1], CK.TileMode.Clamp));
    canvas.drawRRect(label, paper);
    canvas.save();
    canvas.clipRRect(label, CK.ClipOp.Intersect, true);
    const fibre = paint({ alpha: 0.1 });
    fibre.setShader(CK.Shader.MakeFractalNoise(2.4, 2.4, 2, 3, 0, 0));
    fibre.setBlendMode(CK.BlendMode.Multiply);
    canvas.drawRRect(label, fibre);
    canvas.restore();
    canvas.drawRect(R(8, 6, 7, 7), paint({ hex: '#5A2E44' }));
    canvas.drawText('A', x + 9.7 * u, y + 11.7 * u, paint({ hex: '#F4F1EA' }), new CK.Font(cormorant, 6.5 * u));
    for (const ly of [9, 15.2]) canvas.drawLine(x + 18 * u, y + ly * u, x + 91 * u, y + ly * u, paint({ hex: '#8E8E96', alpha: 0.6, stroke: 0.25 * u }));
    canvas.drawText('NR', x + 78 * u, y + 7.8 * u, paint({ hex: '#5A5A60' }), new CK.Font(cormorant, 2.6 * u));
    canvas.drawText(state === 'waiting' ? 'today?' : 'LookBack', x + 19.5 * u, y + 14.3 * u, paint({ hex: '#1D3A7A', alpha: 0.9 }), new CK.Font(caveat, 9 * u));
    // The printed band under the window.
    const band = CK.RRectXY(R(6, 44.5, 88, 6.5), 0.6 * u, 0.6 * u);
    const bandPaint = paint();
    bandPaint.setShader(CK.Shader.MakeLinearGradient(at(6, 0), at(94, 0), [color('#D9CFB6'), color('#EFE8D6'), color('#D3C8AC')], [0, 0.5, 1], CK.TileMode.Clamp));
    canvas.drawRRect(band, bandPaint);
    canvas.drawRect(R(47, 44.5, 11, 6.5), paint({ hex: '#B3261E', alpha: 0.9 }));
    canvas.drawText('HIGH BIAS', x + 9 * u, y + 49 * u, paint({ hex: '#3A3A3E' }), new CK.Font(cormorant, 3.2 * u));
    canvas.drawText('C·60', x + 83 * u, y + 49.2 * u, paint({ hex: '#3A3A3E' }), new CK.Font(cormorant, 3.6 * u));
    // The foot with its holes.
    const foot = svg(`M ${x + 19 * u} ${y + 63 * u} L ${x + 22.5 * u} ${y + 53.5 * u} L ${x + 77.5 * u} ${y + 53.5 * u} L ${x + 81 * u} ${y + 63 * u} Z`);
    const footPaint = paint();
    footPaint.setShader(CK.Shader.MakeLinearGradient(at(0, 53.5), at(0, 63), [color('#26262A'), color('#0E0E10')], [0, 1], CK.TileMode.Clamp));
    canvas.drawPath(foot, footPaint);
    canvas.drawPath(foot, paint({ hex: '#FFFFFF', alpha: 0.06, stroke: 0.4 * u }));
    for (const [hx, r] of [[30, 1.9], [43, 1.3], [57, 1.3], [70, 1.9]]) {
      canvas.drawCircle(...at(hx, 58.6), r * u, paint({ hex: '#000000' }));
      canvas.drawCircle(...at(hx, 58.6 + 0.4), r * u, paint({ hex: '#FFFFFF', alpha: 0.06, stroke: 0.3 * u }));
    }
    for (const [sx, sy] of [[3.6, 3.6], [96.4, 3.6], [3.6, 59.4], [96.4, 59.4], [50, 51.6]]) {
      if (broken && sx === 96.4 && sy === 3.6) continue;
      screwHead(canvas, ...at(sx, sy), 1.6 * u);
    }
    // A soft sheen across the plastic.
    const sheen = paint();
    sheen.setShader(CK.Shader.MakeLinearGradient(at(10, 0), at(60, 63), [color('#FFFFFF', 0), color('#FFFFFF', 0.07), color('#FFFFFF', 0)], [0.2, 0.45, 0.7], CK.TileMode.Clamp));
    canvas.drawRRect(body, sheen);
    canvas.restore();
  }

  if (state === 'missed' || state === 'gone') {
    crack(canvas, crinkle(bezier(at(63, 0), at(58, 8), at(66, 16), at(60, 28), 18), 0.8 * u, rnd), u);
    crack(canvas, crinkle(bezier(at(0, 41), at(8, 44), at(15, 37), at(24, 47), 14), 0.8 * u, rnd), u);
    crack(canvas, crinkle(bezier(at(86, 63), at(84, 56), at(91, 52), at(88, 45), 10), 0.6 * u, rnd), u);
  }
  if (state === 'waiting') {
    tapeStrand(canvas, crinkle(bezier(at(44, 61), at(42, 72), at(54, 74), at(57, 61), 16), 0.1 * u, rnd), 2.6 * u, rnd);
  }
  if (state === 'missed') {
    const loop = crinkle(bezier(at(40, 61), at(26, 92), at(66, 102), at(70, 82), 22), 0.3 * u, rnd).concat(crinkle(bezier(at(70, 82), at(73, 70), at(62, 66), at(58, 61), 12), 0.25 * u, rnd));
    tapeStrand(canvas, loop, 2.7 * u, rnd);
    tapeStrand(canvas, crinkle(bezier(at(42, 61), at(34, 80), at(48, 88), at(54, 78), 14), 0.3 * u, rnd), 2.4 * u, rnd);
  }
  if (state === 'gone') for (const s of nest) if (s.front) tapeStrand(canvas, s.pts, s.w, rnd);
}

/**
 * A close-up of a real cassette filling the icon square (1024): smoky charcoal shell with grain and a soft bevel, the
 * paper label across the top (printed "A" box and rules, "LookBack" in blue ballpoint), a big clear window onto the two
 * wound tape packs and their white toothed hubs, the tape running across, and screws in the corners.
 */
function cassetteFace(canvas, s) {
  const k = s / 1024;
  const X = (v) => v * k;
  // Shell.
  const shell = paint();
  shell.setShader(CK.Shader.MakeLinearGradient([0, 0], [0, s], [color('#3B3C41'), color('#26272B'), color('#18191C'), color('#0F1012')], [0, 0.3, 0.7, 1], CK.TileMode.Clamp));
  canvas.drawRect(CK.XYWHRect(0, 0, s, s), shell);
  const grain = paint({ alpha: 0.22 });
  grain.setShader(CK.Shader.MakeFractalNoise(1.1 / k, 1.1 / k, 2, 9, 0, 0));
  grain.setBlendMode(CK.BlendMode.Overlay);
  canvas.drawRect(CK.XYWHRect(0, 0, s, s), grain);
  // Moulded ridges.
  canvas.drawRRect(CK.RRectXY(CK.XYWHRect(X(40), X(40), X(944), X(944)), X(40), X(40)), paint({ hex: '#000000', alpha: 0.55, stroke: X(5) }));
  canvas.drawRRect(CK.RRectXY(CK.XYWHRect(X(46), X(46), X(932), X(932)), X(36), X(36)), paint({ hex: '#FFFFFF', alpha: 0.07, stroke: X(3) }));

  // The paper label across the top.
  const label = CK.RRectXY(CK.XYWHRect(X(92), X(96), X(840), X(236)), X(14), X(14));
  canvas.drawRRect(CK.RRectXY(CK.XYWHRect(X(92), X(104), X(840), X(236)), X(14), X(14)), paint({ hex: '#000000', alpha: 0.4, blur: X(8) }));
  const paper = paint();
  paper.setShader(CK.Shader.MakeLinearGradient([0, X(96)], [0, X(332)], [color('#F8F4EA'), color('#E8E0CE')], [0, 1], CK.TileMode.Clamp));
  canvas.drawRRect(label, paper);
  canvas.save();
  canvas.clipRRect(label, CK.ClipOp.Intersect, true);
  const fibre = paint({ alpha: 0.12 });
  fibre.setShader(CK.Shader.MakeFractalNoise(1.6 / k, 1.6 / k, 2, 3, 0, 0));
  fibre.setBlendMode(CK.BlendMode.Multiply);
  canvas.drawRRect(label, fibre);
  canvas.drawRect(CK.XYWHRect(X(92), X(286), X(840), X(46)), paint({ hex: '#B3261E', alpha: 0.9 }));
  canvas.drawRect(CK.XYWHRect(X(92), X(286), X(840), X(6)), paint({ hex: '#000000', alpha: 0.12 }));
  canvas.restore();
  canvas.drawRect(CK.XYWHRect(X(126), X(128), X(84), X(84)), paint({ hex: '#4A2638' }));
  canvas.drawText('A', X(146), X(198), paint({ hex: '#F4F1EA' }), new CK.Font(cormorant, X(76)));
  for (const ly of [176, 252]) canvas.drawLine(X(236), X(ly), X(900), X(ly), paint({ hex: '#8E8E96', alpha: 0.55, stroke: X(2.5) }));
  canvas.drawText('LookBack', X(250), X(242), paint({ hex: '#1D3A7A', alpha: 0.92 }), new CK.Font(caveat, X(112)));
  canvas.drawText('C-60   NR', X(760), X(160), paint({ hex: '#5A5A60' }), new CK.Font(cormorant, X(30)));
  canvas.drawText('SIDE A', X(130), X(318), paint({ hex: '#F4EDE0' }), new CK.Font(cormorant, X(30)));

  // The big window: wound tape packs, hubs, the tape across, the glass.
  const win = CK.RRectXY(CK.XYWHRect(X(84), X(392), X(856), X(400)), X(44), X(44));
  canvas.drawRRect(win, paint({ hex: '#0A0A0C' }));
  canvas.save();
  canvas.clipRRect(win, CK.ClipOp.Intersect, true);
  for (const [cx, r] of [[X(300), X(186)], [X(724), X(140)]]) {
    const cy = X(592);
    const pack = paint();
    pack.setShader(CK.Shader.MakeRadialGradient([cx, cy], r, [color('#24150C'), color('#4F3121'), color('#5C3A27'), color('#3A2416')], [0.35, 0.7, 0.92, 1], CK.TileMode.Clamp));
    canvas.drawCircle(cx, cy, r, pack);
    for (let rr = X(80); rr < r; rr += X(7)) canvas.drawCircle(cx, cy, rr, paint({ hex: '#000000', alpha: 0.1, stroke: X(1.2) }));
    canvas.drawCircle(cx, cy, r, paint({ hex: '#A57A56', alpha: 0.35, stroke: X(2) }));
    // The pack's satin sheen.
    const sh = paint({ stroke: r * 0.5 });
    sh.setShader(CK.Shader.MakeSweepGradient(cx, cy, [color('#FFFFFF', 0), color('#FFFFFF', 0.12), color('#FFFFFF', 0), color('#FFFFFF', 0.08), color('#FFFFFF', 0)], [0, 0.15, 0.35, 0.6, 1], CK.TileMode.Clamp));
    canvas.drawCircle(cx, cy, r * 0.72, sh);
  }
  canvas.drawRect(CK.XYWHRect(X(84), X(752), X(856), X(14)), paint({ hex: '#3A2416' }));
  canvas.restore();
  for (const cx of [X(300), X(724)]) {
    const cy = X(592);
    const hub = paint();
    hub.setShader(CK.Shader.MakeRadialGradient([cx - X(20), cy - X(24)], X(100), [color('#FFFFFF'), color('#E9E9E6'), color('#B5B5B1')], [0, 0.55, 1], CK.TileMode.Clamp));
    canvas.drawCircle(cx, cy, X(74), hub);
    canvas.drawCircle(cx, cy, X(74), paint({ hex: '#000000', alpha: 0.3, stroke: X(3) }));
    canvas.drawCircle(cx, cy, X(34), paint({ hex: '#141416' }));
    for (let t = 0; t < 6; t++) {
      const a = (t * Math.PI) / 3 + 0.3;
      canvas.drawLine(cx + Math.cos(a) * X(18), cy + Math.sin(a) * X(18), cx + Math.cos(a) * X(34), cy + Math.sin(a) * X(34), paint({ hex: '#F2F2F0', stroke: X(9) }));
    }
    for (let t = 0; t < 3; t++) {
      const a = (t * 2 * Math.PI) / 3;
      canvas.drawCircle(cx + Math.cos(a) * X(54), cy + Math.sin(a) * X(54), X(9), paint({ hex: '#CFCFCB' }));
    }
  }
  const glare = paint();
  glare.setShader(CK.Shader.MakeLinearGradient([X(84), X(392)], [X(940), X(792)], [color('#FFFFFF', 0.2), color('#FFFFFF', 0.03), color('#FFFFFF', 0.12), color('#FFFFFF', 0)], [0, 0.3, 0.42, 0.8], CK.TileMode.Clamp));
  canvas.drawRRect(win, glare);
  canvas.drawRRect(win, paint({ hex: '#6A6A72', alpha: 0.7, stroke: X(4) }));

  // The foot strip with its holes, and screws in the corners.
  canvas.drawRect(CK.XYWHRect(X(210), X(842), X(604), X(182)), paint({ hex: '#111113' }));
  canvas.drawRect(CK.XYWHRect(X(210), X(842), X(604), X(4)), paint({ hex: '#FFFFFF', alpha: 0.08 }));
  for (const [hx, r] of [[320, 34], [450, 22], [574, 22], [704, 34]]) canvas.drawCircle(X(hx), X(930), X(r), paint({ hex: '#000000' }));
  for (const [sx, sy] of [[96, 870], [928, 870], [512, 360]]) screwHead(canvas, X(sx), X(sy), X(22));
  // A soft sheen across the whole face, and a darker edge.
  const vig = paint();
  vig.setShader(CK.Shader.MakeRadialGradient([s * 0.5, s * 0.45], s * 0.75, [color('#000000', 0), color('#000000', 0), color('#000000', 0.45)], [0, 0.6, 1], CK.TileMode.Clamp));
  canvas.drawRect(CK.XYWHRect(0, 0, s, s), vig);
}

/** A crack in hard plastic: a dark split with a pale stress-whitened lip. `pts` in px. */
function plasticCrack(canvas, pts, w) {
  const p = svg('M ' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L '));
  canvas.drawPath(p, paint({ hex: '#E6E6EA', alpha: 0.3, stroke: w * 3, blur: w }));
  canvas.drawPath(p, paint({ hex: '#000000', stroke: w }));
  canvas.drawPath(p, paint({ hex: '#D8D8DE', alpha: 0.75, stroke: w * 0.4 }));
}
/** A jagged line from a to b in `n` steps, seeded. */
function jag(a, b, n, amp, rnd) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    const k = i === 0 || i === n ? 0 : (rnd() - 0.5) * 2 * amp;
    out.push([x + (nx / len) * k, y + (ny / len) * k]);
  }
  return out;
}

/**
 * The icon in its state. 'default' pristine; 'waiting' a hairline crack in from a corner; 'missed' an impact point with
 * cracks radiating across and a chip knocked out; 'gone' shattered into shards with gaps and missing pieces.
 */
function oldCassetteIcon(canvas, s, state) {
  const rnd = seeded(state === 'gone' ? 77 : state === 'missed' ? 31 : 13);
  if (state !== 'gone') {
    cassetteFace(canvas, s);
  }
  const w = s / 340;
  if (state === 'waiting') {
    plasticCrack(canvas, jag([s * 0.98, s * 0.06], [s * 0.7, s * 0.3], 9, s * 0.012, rnd), w);
  }
  if (state === 'missed') {
    const P = [s * 0.62, s * 0.44];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.5;
      const len = s * (0.35 + rnd() * 0.45);
      plasticCrack(canvas, jag(P, [P[0] + Math.cos(a) * len, P[1] + Math.sin(a) * len], 10, s * 0.014, rnd), w);
    }
    // A ring of short cracks round the impact, and a chip knocked out of it.
    const ring = Array.from({ length: 11 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const r = s * (0.07 + rnd() * 0.03);
      return [P[0] + Math.cos(a) * r, P[1] + Math.sin(a) * r];
    });
    plasticCrack(canvas, ring, w);
    const chip = svg(`M ${P[0] - s * 0.03} ${P[1] - s * 0.02} L ${P[0] + s * 0.02} ${P[1] - s * 0.035} L ${P[0] + s * 0.035} ${P[1] + s * 0.015} L ${P[0] - s * 0.005} ${P[1] + s * 0.03} Z`);
    canvas.drawPath(chip, paint({ hex: '#050506' }));
    canvas.drawPath(chip, paint({ hex: '#D8D8DE', alpha: 0.6, stroke: w * 0.6 }));
  }
  if (state === 'gone') {
    // Shattered: shards cut by rays and rings round an impact point, each knocked a little out of place; a few gone.
    canvas.clear(color('#0B0B0C'));
    const surf = CK.MakeSurface(s, s);
    cassetteFace(surf.getCanvas(), s);
    surf.flush();
    const img = surf.makeImageSnapshot();
    const P = [s * 0.55, s * 0.48];
    const rays = 9;
    const angles = Array.from({ length: rays }, (_, i) => (i / rays) * Math.PI * 2 + (rnd() - 0.5) * 0.4).sort((a, b) => a - b);
    const rings = [s * 0.16, s * 0.42, s * 1.2];
    const missing = new Set([3, 11, 16]);
    let n = 0;
    for (let r = 0; r < rings.length; r++) {
      const r0 = r === 0 ? 0 : rings[r - 1];
      const r1 = rings[r];
      for (let i = 0; i < rays; i++) {
        const a0 = angles[i];
        const a1 = angles[(i + 1) % rays] + (i === rays - 1 ? Math.PI * 2 : 0);
        const j = () => 1 + (rnd() - 0.5) * 0.18;
        const pts = r === 0
          ? [P, [P[0] + Math.cos(a0) * r1 * j(), P[1] + Math.sin(a0) * r1 * j()], [P[0] + Math.cos((a0 + a1) / 2) * r1, P[1] + Math.sin((a0 + a1) / 2) * r1], [P[0] + Math.cos(a1) * r1 * j(), P[1] + Math.sin(a1) * r1 * j()]]
          : [[P[0] + Math.cos(a0) * r0, P[1] + Math.sin(a0) * r0], [P[0] + Math.cos(a0) * r1, P[1] + Math.sin(a0) * r1], [P[0] + Math.cos(a1) * r1, P[1] + Math.sin(a1) * r1], [P[0] + Math.cos(a1) * r0, P[1] + Math.sin(a1) * r0]];
        n++;
        if (missing.has(n)) continue;
        const clip = svg('M ' + pts.map(([x, y]) => `${x} ${y}`).join(' L ') + ' Z');
        const mid = (a0 + a1) / 2;
        const push = s * (0.008 + r * 0.012 + rnd() * 0.01);
        canvas.save();
        canvas.translate(Math.cos(mid) * push, Math.sin(mid) * push);
        canvas.rotate((rnd() - 0.5) * 5, P[0], P[1]);
        canvas.clipPath(clip, CK.ClipOp.Intersect, true);
        canvas.drawImage(img, 0, 0, paint());
        canvas.restore();
        // The broken edge of each shard catches the light.
        canvas.save();
        canvas.translate(Math.cos(mid) * push, Math.sin(mid) * push);
        canvas.drawPath(clip, paint({ hex: '#CFCFD6', alpha: 0.35, stroke: w * 0.8 }));
        canvas.restore();
      }
    }
    surf.delete();
  }
}

/** The icon's backdrop: black, with a warm amber glow from the top left, like a desk lamp on the cassette. */
function woodBg(canvas, s) {
  canvas.clear(color('#000000'));
  const glow = paint();
  glow.setShader(CK.Shader.MakeRadialGradient([s * 0.3, s * 0.2], s * 1.1, [color('#E2B000'), color('#000000'), color('#000000')], [0, 0.45, 1], CK.TileMode.Clamp));
  canvas.drawRect(CK.XYWHRect(0, 0, s, s), glow);
  canvas.drawRect(CK.XYWHRect(0, 0, s, s), paint({ hex: '#000000', alpha: 0.12 }));
}

/**
 * The cassette exactly as the app shows it (src/components/scrapbook/Cassette.tsx, in its 100 × 63 units): black shell,
 * cream label with the "A" box and "LookBack" handwritten, red stripe, the smoked window onto the brown tape packs and
 * white hubs, the printed band ("LOOKBACK" · "C·365"), the trapezoid with its holes and the screws. Drawn `w` wide at
 * (x, y), tilted a little and casting a shadow, on a transparent sheet.
 */
function appCassette(canvas, x, y, w, { shadow = true, tilt = -4 } = {}) {
  const u = w / 100;
  const R = (l, t, ww, hh) => CK.XYWHRect(x + l * u, y + t * u, ww * u, hh * u);
  const RR = (l, t, ww, hh, r) => CK.RRectXY(R(l, t, ww, hh), r * u, r * u);
  canvas.save();
  canvas.rotate(tilt, x + 50 * u, y + 31.5 * u);
  if (shadow) {
    canvas.drawRRect(RR(1, 4, 100, 63, 3), paint({ hex: '#000000', alpha: 0.6, blur: 4 * u }));
    canvas.drawRRect(RR(0, 1.5, 100, 63, 3), paint({ hex: '#000000', alpha: 0.5, blur: 1.2 * u }));
  }
  // Shell.
  const shell = paint();
  shell.setShader(CK.Shader.MakeLinearGradient([0, y], [0, y + 63 * u], [color('#2E2E31'), color('#1C1C1E'), color('#121213')], [0, 0.3, 1], CK.TileMode.Clamp));
  canvas.drawRRect(RR(0, 0, 100, 63, 3), shell);
  canvas.drawRRect(RR(0.3, 0.3, 99.4, 62.4, 2.8), paint({ hex: '#3A3A3D', stroke: 0.6 * u }));
  canvas.drawRRect(RR(1.2, 1.2, 97.6, 60.6, 2.4), paint({ hex: '#FFFFFF', alpha: 0.06, stroke: 0.4 * u }));
  // Window, and what shows through it.
  const win = RR(14, 21.5, 72, 19.5, 2.2);
  canvas.save();
  canvas.clipRRect(win, CK.ClipOp.Intersect, true);
  canvas.drawRRect(win, paint({ hex: '#2A211C' }));
  const hubY = y + 31 * u;
  const packs = [15.8, 10.2];
  [29, 71].forEach((hx, i) => {
    const cx = x + hx * u;
    canvas.drawCircle(cx, hubY, packs[i] * u, radial(cx, hubY, packs[i] * u, ['#4A2E1F', '#4A2E1F', '#2E1C12'], [0, 0.4, 1]));
  });
  canvas.drawRect(R(14, 41 - 1.5 - 0.9, 72, 0.9), paint({ hex: '#4A2E1F' }));
  [29, 71].forEach((hx) => {
    const cx = x + hx * u;
    const r = 7.5 * u;
    canvas.drawCircle(cx, hubY, r, paint({ hex: '#F2F2F0' }));
    canvas.drawCircle(cx, hubY, r - 0.3 * u, paint({ hex: '#BDBDBB', stroke: 0.6 * u }));
    canvas.drawCircle(cx, hubY, r * 0.475, paint({ hex: '#1A1A1A' }));
    for (const a of [0, 60, 120]) {
      canvas.save();
      canvas.rotate(a + 15, cx, hubY);
      canvas.drawRect(CK.XYWHRect(cx - 0.65 * u, hubY - r * 0.65, 1.3 * u, r * 1.3), paint({ hex: '#F2F2F0' }));
      canvas.restore();
    }
  });
  const glint = paint();
  glint.setShader(CK.Shader.MakeLinearGradient([x + 14 * u, y + 21.5 * u], [x + 40 * u, y + 41 * u], [color('#FFFFFF', 0.22), color('#FFFFFF', 0.04), color('#000000', 0.25)], [0, 0.35, 1], CK.TileMode.Clamp));
  canvas.drawRRect(win, glint);
  canvas.restore();
  canvas.drawRRect(win, paint({ hex: '#55555A', stroke: 0.6 * u }));
  // Red stripe and the label.
  canvas.drawRect(R(6, 17.6, 88, 1.6), paint({ hex: '#C8372B' }));
  canvas.drawRRect(RR(6, 4, 88, 13.6, 1.2), paint({ hex: '#F4F1EA' }));
  canvas.drawRect(R(8, 7.3, 7, 7), paint({ hex: '#4A2A3A' }));
  canvas.drawText('A', x + 9.9 * u, y + 12.9 * u, paint({ hex: '#F4F1EA' }), new CK.Font(cormorant, 6 * u));
  canvas.drawText('LookBack', x + 17 * u, y + 15 * u, paint({ hex: '#23304A' }), new CK.Font(caveat, 8.5 * u));
  canvas.drawRect(R(17, 15.9, 74, 0.4), paint({ hex: '#9A9A9A' }));
  // The band.
  canvas.drawRRect(RR(6, 44, 88, 7, 0.8), paint({ hex: '#E9DFC4' }));
  canvas.drawRect(R(46, 44, 12, 7), paint({ hex: '#C8372B', alpha: 0.85 }));
  canvas.drawText('LOOKBACK', x + 8 * u, y + 49.2 * u, paint({ hex: '#2A2118' }), new CK.Font(cormorant, 4.2 * u));
  canvas.drawText('C·365', x + 82 * u, y + 49.2 * u, paint({ hex: '#2A2118' }), new CK.Font(cormorant, 4.2 * u));
  // The trapezoid at the foot, with its holes.
  canvas.drawPath(svg(`M ${x + 20 * u} ${y + 63 * u} L ${x + 22 * u} ${y + 54 * u} L ${x + 78 * u} ${y + 54 * u} L ${x + 80 * u} ${y + 63 * u} Z`), paint({ hex: '#141416' }));
  canvas.drawPath(svg(`M ${x + 20 * u} ${y + 63 * u} L ${x + 22 * u} ${y + 54 * u} L ${x + 78 * u} ${y + 54 * u} L ${x + 80 * u} ${y + 63 * u}`), paint({ hex: '#3A3A3D', stroke: 0.4 * u }));
  [[30, 1.75], [43, 1.25], [57, 1.25], [70, 1.75]].forEach(([hx, r]) => canvas.drawCircle(x + hx * u, y + 58.5 * u, r * u, paint({ hex: '#050505' })));
  // Screws.
  [[3.3, 3.3], [96.7, 3.3], [3.3, 59.7], [96.7, 59.7], [50, 51.3]].forEach(([sx, sy]) => {
    const cx = x + sx * u;
    const cy = y + sy * u;
    canvas.drawCircle(cx, cy, 1.8 * u, radial(cx - 0.5 * u, cy - 0.5 * u, 2 * u, ['#C4C4C8', '#8C8C90', '#55555A'], [0, 0.6, 1]));
    canvas.save();
    canvas.rotate(45, cx, cy);
    canvas.drawRect(CK.XYWHRect(cx - 1.2 * u, cy - 0.25 * u, 2.4 * u, 0.5 * u), paint({ hex: '#444' }));
    canvas.restore();
  });
  canvas.restore();
}

/** Where the cassette sits in an icon square `s` across: 84% wide, centred. */
const CASS = (s) => ({ x: s * 0.08, y: (s - s * 0.84 * 0.63) / 2, w: s * 0.84 });

/**
 * The icon: the app's cassette under a warm lamp glow on black, breaking as days go unwritten (see src/lib/appIcon.ts): a
 * hairline crack while today waits; cracks radiating from an impact after a missed day; shattered after four days.
 * With `wood: false` only the cassette is drawn (the Android adaptive foreground, over the glow background layer).
 */
function cassetteIcon(canvas, s, state, { wood = true } = {}) {
  const rnd = seeded(state === 'gone' ? 77 : state === 'missed' ? 31 : 13);
  const { x, y, w } = CASS(s);
  const u = w / 100;
  const lw = s / 340;
  if (wood) woodBg(canvas, s);
  // The shell's outline (tilted like the cassette), so cracks stay on the plastic.
  const shellClip = () => {
    canvas.rotate(-4, x + 50 * u, y + 31.5 * u);
    canvas.clipRRect(CK.RRectXY(CK.XYWHRect(x, y, w, 63 * u), 3 * u, 3 * u), CK.ClipOp.Intersect, true);
    canvas.rotate(4, x + 50 * u, y + 31.5 * u);
  };
  if (state !== 'gone') appCassette(canvas, x, y, w);
  if (state === 'waiting') {
    canvas.save();
    shellClip();
    plasticCrack(canvas, jag([x + w * 0.98, y + 2 * u], [x + w * 0.74, y + 26 * u], 9, s * 0.01, rnd), lw);
    canvas.restore();
  }
  if (state === 'missed') {
    canvas.save();
    shellClip();
    const P = [x + 60 * u, y + 34 * u];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.5;
      const len = w * (0.25 + rnd() * 0.4);
      plasticCrack(canvas, jag(P, [P[0] + Math.cos(a) * len, P[1] + Math.sin(a) * len], 10, s * 0.012, rnd), lw);
    }
    const ring = Array.from({ length: 11 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const r = w * (0.06 + rnd() * 0.025);
      return [P[0] + Math.cos(a) * r, P[1] + Math.sin(a) * r];
    });
    plasticCrack(canvas, ring, lw);
    const c = w * 0.03;
    const chip = svg(`M ${P[0] - c} ${P[1] - c * 0.7} L ${P[0] + c * 0.7} ${P[1] - c * 1.1} L ${P[0] + c * 1.1} ${P[1] + c * 0.5} L ${P[0] - c * 0.2} ${P[1] + c} Z`);
    canvas.drawPath(chip, paint({ hex: '#050506' }));
    canvas.drawPath(chip, paint({ hex: '#D8D8DE', alpha: 0.6, stroke: lw * 0.6 }));
    canvas.restore();
  }
  if (state === 'gone') {
    // Shattered: shards cut by rays and rings round an impact, each knocked out of place, a few gone (the table shows).
    const surf = CK.MakeSurface(s, s);
    appCassette(surf.getCanvas(), x, y, w, { shadow: false });
    surf.flush();
    const img = surf.makeImageSnapshot();
    const P = [x + 55 * u, y + 32 * u];
    const rays = 9;
    const angles = Array.from({ length: rays }, (_, i) => (i / rays) * Math.PI * 2 + (rnd() - 0.5) * 0.4).sort((a, b) => a - b);
    const rings = [w * 0.14, w * 0.32, w * 1.2];
    const missing = new Set([3, 11, 16]);
    let n = 0;
    for (let r = 0; r < rings.length; r++) {
      const r0 = r === 0 ? 0 : rings[r - 1];
      const r1 = rings[r];
      for (let i = 0; i < rays; i++) {
        const a0 = angles[i];
        const a1 = angles[(i + 1) % rays] + (i === rays - 1 ? Math.PI * 2 : 0);
        const j = () => 1 + (rnd() - 0.5) * 0.18;
        const pts = r === 0
          ? [P, [P[0] + Math.cos(a0) * r1 * j(), P[1] + Math.sin(a0) * r1 * j()], [P[0] + Math.cos((a0 + a1) / 2) * r1, P[1] + Math.sin((a0 + a1) / 2) * r1], [P[0] + Math.cos(a1) * r1 * j(), P[1] + Math.sin(a1) * r1 * j()]]
          : [[P[0] + Math.cos(a0) * r0, P[1] + Math.sin(a0) * r0], [P[0] + Math.cos(a0) * r1, P[1] + Math.sin(a0) * r1], [P[0] + Math.cos(a1) * r1, P[1] + Math.sin(a1) * r1], [P[0] + Math.cos(a1) * r0, P[1] + Math.sin(a1) * r0]];
        n++;
        if (missing.has(n)) continue;
        const clip = svg('M ' + pts.map(([px, py]) => `${px} ${py}`).join(' L ') + ' Z');
        const mid = (a0 + a1) / 2;
        const push = s * (0.01 + r * 0.014 + rnd() * 0.01);
        canvas.save();
        canvas.translate(Math.cos(mid) * push, Math.sin(mid) * push);
        canvas.rotate((rnd() - 0.5) * 6, P[0], P[1]);
        canvas.clipPath(clip, CK.ClipOp.Intersect, true);
        // Each shard casts its own little shadow on the table.
        canvas.drawImage(img, 0, 0, paint());
        canvas.restore();
        canvas.save();
        canvas.translate(Math.cos(mid) * push, Math.sin(mid) * push);
        canvas.rotate(-4, x + 50 * u, y + 31.5 * u);
        canvas.clipRRect(CK.RRectXY(CK.XYWHRect(x, y, w, 63 * u), 3 * u, 3 * u), CK.ClipOp.Intersect, true);
        canvas.rotate(4, x + 50 * u, y + 31.5 * u);
        canvas.drawPath(clip, paint({ hex: '#CFCFD6', alpha: 0.4, stroke: lw * 0.8 }));
        canvas.restore();
      }
    }
    surf.delete();
  }
}

/**
 * The app icon is a close-up of a real cassette filling the square, and it breaks as days go unwritten, so it is
 * noticed: a hairline crack while today waits; cracks radiating from an impact after a missed day; shattered after
 * four days (see src/lib/appIcon.ts). Each state is an icon set: a full iOS icon and an Android adaptive foreground.
 */
const ICON_STATES = [
  { file: 'icon', state: 'default' },
  { file: 'icon-waiting', state: 'waiting' },
  { file: 'icon-missed', state: 'missed' },
  { file: 'icon-gone', state: 'gone' },
];
let iconBytes;
for (const { file, state } of ICON_STATES) {
  const bytes = render(S, (c) => cassetteIcon(c, S, state), `${file}.png`);
  if (file === 'icon') iconBytes = bytes;
  // Adaptive: the whole face, shrunk a little so the window and label sit inside the safe zone.
  render(
    S,
    (c) => {
      c.save();
      c.translate(S * 0.17, S * 0.17);
      c.scale(0.66, 0.66);
      cassetteIcon(c, S, state, { wood: false });
      c.restore();
    },
    file === 'icon' ? 'android-icon-foreground.png' : `android-${file}-foreground.png`,
  );
}
// Android adaptive icon background layer: black with the lamp's amber glow.
render(S, (c) => woodBg(c, S), 'android-icon-background.png');
render(S, (c) => cassette(c, S * 0.2, (S - S * 0.6 * 0.63) / 2, (S * 0.6) / 100, { mono: true }), 'android-icon-monochrome.png');

/** The app icon (the intact cassette) as a rounded tile at (x, y), `size` across, on a transparent sheet. */
function cassetteTile(c, x, y, size, state = 'default') {
  c.save();
  c.clipRRect(CK.RRectXY(CK.XYWHRect(x, y, size, size), size * 0.2, size * 0.2), CK.ClipOp.Intersect, true);
  c.translate(x, y);
  c.scale(size / S, size / S);
  cassetteIcon(c, S, state);
  c.restore();
}

// The app's mark (src/components/scrapbook/Buddy.tsx, the widget too): the app icon itself, as a rounded tile filling
// 96% of the picture (the old stamp's ring sat there too, so every page that shows it keeps its layout).
render(600, (c) => cassetteTile(c, 12, 12, 576), 'stamp.png');

// Splash: nothing but the dark background (a transparent sheet), so the app opens straight into the intro's cassette.
render(S, (c) => c.clear(color('#000000', 0)), 'splash-icon.png');

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
// The same open-eyed moods mid-blink: the app lays this over the pose for a moment every few seconds.
for (const mood of ['happy', 'wave', 'peek']) {
  render(BUDDY_PX, (c) => {
    c.scale(BUDDY_PX / 100, BUDDY_PX / 100);
    drawBunny(c, { mood, bow: null, blink: true });
  }, `buddy/${mood}-blink.png`, mood === 'peek' ? BUDDY_PX * 0.68 : BUDDY_PX);
}
render(BUDDY_PX, (c) => {
  c.scale(BUDDY_PX / 100, BUDDY_PX / 100);
  drawBow(c, C.white);
}, 'buddy/bow.png');

// The widget picker's preview: the cassette widget (src/widget/TodayWidget.tsx) on a dark stage, lit from behind.
render(
  640,
  (c) => {
    const card = CK.RRectXY(CK.XYWHRect(8, 8, 624, 464), 44, 44);
    c.drawRRect(card, paint({ hex: '#0B0B0C' }));
    c.save();
    c.clipRRect(card, CK.ClipOp.Intersect, true);
    const glow = paint();
    glow.setShader(CK.Shader.MakeRadialGradient([320, 200], 330, [color('#B8893E', 0.55), color('#B8893E', 0.12), color('#B8893E', 0)], [0, 0.55, 1], CK.TileMode.Clamp));
    c.drawRect(CK.XYWHRect(0, 0, 640, 480), glow);
    c.restore();
    appCassette(c, 60, 34, 520, { tilt: 0 });
    const print = (size) => new CK.Font(fell, size);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(40, 404, 210, 46), 23, 23), paint({ hex: '#B8893E', stroke: 2 }));
    c.drawCircle(66, 427, 7, paint({ hex: '#C8372B' }));
    c.drawText('record today', 82, 436, paint({ hex: '#C8372B' }), print(26));
    c.drawText('LookBack', 470, 436, paint({ hex: '#EDE3CC', alpha: 0.6 }), print(26));
  },
  'widget-preview.png',
  480,
);

// Notifications. Status-bar icon: Android wants a 96x96 all-white silhouette (it tints it): the cassette.
render(96, (c) => cassette(c, 96 * 0.08, (96 - 96 * 0.84 * 0.63) / 2, (96 * 0.84) / 100, { mono: true }), 'notification-icon.png');
// Large picture next to the text: the app icon, in a circle.
render(256, (c) => {
  const clip = svg('M 128 0 A 128 128 0 1 1 127.9 0 Z');
  c.save();
  c.clipPath(clip, CK.ClipOp.Intersect, true);
  c.scale(256 / S, 256 / S);
  cassetteIcon(c, S, 'default');
  c.restore();
}, 'notification-large.png');
