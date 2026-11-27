/**
 * Paints the Google Play feature graphic (1024×500): the leather cover with gilt stitching and a warm lamp glow,
 * the name and tagline on the left, and the LookBack cassette (the app icon's own foreground layer) on the right.
 *
 *   node scripts/make-feature-graphic.mjs   → docs/play-store/graphics/feature-graphic-1024x500.png
 *
 * Colors and fonts match scripts/make-icons.mjs (L palette, Caveat, Cormorant Garamond, IM Fell English).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CanvasKitInit = require('canvaskit-wasm');
const CK = await CanvasKitInit({ locateFile: (file) => path.join(root, 'node_modules/canvaskit-wasm/bin', file) });

const L = {
  leather: '#1F3A2E',
  giltBright: '#E3C27C',
  gilt: '#C9A45C',
  giltDeep: '#8E6F33',
  page: '#EFE4CC',
  lamp: '#C8960C',
  white: '#FFFFFF',
  black: '#000000',
};
const W = 1024;
const H = 500;

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
  }
  if (blur > 0) p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, blur, true));
  return p;
}
const font = (file) => CK.Typeface.MakeTypefaceFromData(readFileSync(path.join(root, 'node_modules/@expo-google-fonts', file)).buffer);
const caveat = font('caveat/700Bold/Caveat_700Bold.ttf');
const cormorant = font('cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf');
const fell = font('im-fell-english/400Regular_Italic/IMFellEnglish_400Regular_Italic.ttf');

function textWidth(f, text) {
  return f.getGlyphWidths(f.getGlyphIDs(text)).reduce((a, b) => a + b, 0);
}
function gilt(x0, y0, x1, y1) {
  const p = paint();
  p.setShader(CK.Shader.MakeLinearGradient([x0, y0], [x1, y1], [color(L.giltBright), color(L.gilt), color(L.giltDeep)], [0, 0.55, 1], CK.TileMode.Clamp));
  return p;
}

const surface = CK.MakeSurface(W, H);
const canvas = surface.getCanvas();

// Leather: base, pebble grain, mottling, a sheen from the top left and darker edges.
canvas.clear(color(L.leather));
const grain = paint({ alpha: 0.16 });
grain.setShader(CK.Shader.MakeFractalNoise(0.18, 0.18, 2, 7, 0, 0));
grain.setBlendMode(CK.BlendMode.Overlay);
canvas.drawRect(CK.XYWHRect(0, 0, W, H), grain);
const mottle = paint({ alpha: 0.22 });
mottle.setShader(CK.Shader.MakeFractalNoise(0.004, 0.004, 2, 3, 0, 0));
mottle.setBlendMode(CK.BlendMode.Multiply);
canvas.drawRect(CK.XYWHRect(0, 0, W, H), mottle);

// The lamp's warm glow behind the cassette (as in the app icon).
const glow = paint();
glow.setShader(CK.Shader.MakeRadialGradient([W * 0.68, H * 0.22], 360, [color(L.lamp, 0.55), color(L.lamp, 0)], [0, 1], CK.TileMode.Clamp));
canvas.drawRect(CK.XYWHRect(0, 0, W, H), glow);
const edge = paint();
edge.setShader(CK.Shader.MakeRadialGradient([W / 2, H / 2], W * 0.62, [color(L.black, 0), color(L.black, 0), color(L.black, 0.45)], [0, 0.55, 1], CK.TileMode.Clamp));
canvas.drawRect(CK.XYWHRect(0, 0, W, H), edge);

// Gilt stitching just inside the edge.
const inset = 22;
const dash = paint({ hex: L.gilt, alpha: 0.55, stroke: 2.4 });
dash.setPathEffect(CK.PathEffect.MakeDash([11, 8], 0));
canvas.drawRRect(CK.RRectXY(CK.XYWHRect(inset, inset, W - inset * 2, H - inset * 2), 26, 26), dash);

// The cassette: the icon's foreground layer (1024², tape in the middle ~60%), scaled so the tape is ~520 px wide.
const tape = CK.MakeImageFromEncoded(readFileSync(path.join(root, 'assets/android-icon-foreground.png')));
const size = 900;
const cx = W * 0.705;
const cy = H * 0.52;
canvas.drawImageRect(
  tape,
  CK.XYWHRect(0, 0, tape.width(), tape.height()),
  CK.XYWHRect(cx - size / 2, cy - size / 2, size, size),
  paint(),
);

// Name, a gilt rule and the tagline on the left.
const left = 70;
const title = new CK.Font(cormorant, 92);
const titleText = 'LookBack';
const titleW = textWidth(title, titleText);
const shadow = paint({ hex: L.black, alpha: 0.55, blur: 3 });
canvas.drawText(titleText, left + 2, 214, shadow, title);
canvas.drawText(titleText, left, 210, gilt(left, 140, left + titleW, 215), title);

canvas.drawRect(CK.XYWHRect(left + 2, 238, titleW * 0.82, 2.2), gilt(left, 238, left + titleW, 241));
canvas.drawCircle(left + titleW * 0.82 + 14, 239, 4, gilt(left + titleW, 232, left + titleW + 20, 246));

const tag = new CK.Font(fell, 34);
canvas.drawText('one small thing a day,', left, 296, paint({ hex: L.page, alpha: 0.95 }), tag);
canvas.drawText('back to you next year', left, 340, paint({ hex: L.page, alpha: 0.95 }), tag);

const note = new CK.Font(caveat, 30);
canvas.drawText('words · photos · your voice on tape', left, 400, paint({ hex: L.giltBright, alpha: 0.9 }), note);

const out = path.join(root, 'docs/play-store/graphics/feature-graphic-1024x500.png');
const png = surface.makeImageSnapshot().encodeToBytes();
writeFileSync(out, png);
console.log('wrote', path.relative(root, out), png.length, 'bytes');
