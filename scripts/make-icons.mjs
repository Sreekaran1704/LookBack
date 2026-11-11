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
function drawBunny(canvas, { mood = 'happy', bow = C.coral, mono = false, eyes = EYES } = {}) {
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

/**
 * The app icon is the bunny on its own, whole, on the peach page, and it is alive: when today's page
 * is still empty it switches to a pleading bunny, and after a missed day to a teary one (see
 * src/lib/appIcon.ts). Each state is an icon set: a full iOS icon, plus an Android adaptive foreground
 * with the page baked in (alternate icons on Android take a foreground image and a plain color).
 * The bunny sits inside the adaptive safe zone (the middle 66%), so every launcher mask shows all of it.
 */
const ICON_STATES = [
  { file: 'icon', mood: 'wave' },
  { file: 'icon-waiting', mood: 'plead' },
  { file: 'icon-missed', mood: 'cry' },
  { file: 'icon-gone', mood: 'wail' },
];
const ICON_SCALE = 8.6; // 860 px bunny on the 1024 full-bleed icon
const ADAPTIVE_SCALE = 6.0; // 600 px: inside the 676 px safe zone
let iconBytes;
for (const { file, mood } of ICON_STATES) {
  const bytes = render(
    S,
    (c) => {
      dottedPaper(c, S);
      bunnyAt(c, S / 2 - ICON_SCALE * 50, S / 2 - ICON_SCALE * 53, ICON_SCALE, { mood });
    },
    `${file}.png`,
  );
  if (file === 'icon') iconBytes = bytes;
  render(
    S,
    (c) => {
      if (file !== 'icon') dottedPaper(c, S, { margin: false });
      bunnyAt(c, S / 2 - ADAPTIVE_SCALE * 50, S / 2 - ADAPTIVE_SCALE * 52, ADAPTIVE_SCALE, { mood });
    },
    file === 'icon' ? 'android-icon-foreground.png' : `android-${file}-foreground.png`,
  );
}
// Android adaptive icon background layer: the page.
render(S, (c) => dottedPaper(c, S, { margin: false }), 'android-icon-background.png');
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

// The widget picker's preview: the home-screen widget on an empty day (src/widget/TodayWidget.tsx).
render(
  640,
  (c) => {
    const card = CK.RRectXY(CK.XYWHRect(8, 8, 624, 304), 48, 48);
    c.drawRRect(card, paint({ hex: C.shadow, alpha: 0.18, blur: 8 }));
    c.save();
    c.clipRRect(card, CK.ClipOp.Intersect, true);
    dottedPaper(c, 640, { margin: false });
    c.restore();
    bunnyAt(c, 28, 52, 2.1, { mood: 'wave' });
    const font = (size) => new CK.Font(caveat, size);
    c.drawText('today', 262, 92, paint({ hex: C.ink }), font(46));
    c.drawText('Nov 11', 500, 90, paint({ hex: C.ink, alpha: 0.55 }), font(34));
    c.drawText("What's one small thing", 262, 150, paint({ hex: C.ink }), font(38));
    c.drawText('from today?', 262, 192, paint({ hex: C.ink }), font(38));
    c.drawRRect(CK.RRectXY(CK.XYWHRect(262, 222, 176, 52), 26, 26), paint({ hex: C.coral }));
    c.drawText('+ add today', 284, 258, paint({ hex: C.white }), font(34));
    // A strip of tape across the top.
    rotated(c, -3, 320, 18, () => c.drawRect(CK.XYWHRect(250, 4, 140, 30), paint({ hex: C.coral, alpha: 0.85 })));
  },
  'widget-preview.png',
  320,
);

// Notifications. Status-bar icon: Android wants a 96x96 all-white silhouette (it tints it).
render(96, (c) => {
  c.scale(96 / 100, 96 / 100);
  drawBunny(c, { mood: 'wave', mono: true });
}, 'notification-icon.png');
// Large picture next to the text: the bunny waving on a round peach dotted page.
render(256, (c) => {
  const clip = svg('M 128 0 A 128 128 0 1 1 127.9 0 Z');
  c.save();
  c.clipPath(clip, CK.ClipOp.Intersect, true);
  dottedPaper(c, 256, { margin: false });
  c.restore();
  bunnyAt(c, 128 - 2.05 * 50, 30, 2.05, { mood: 'wave' });
}, 'notification-large.png');
