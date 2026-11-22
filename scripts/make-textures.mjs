/**
 * Paints the app's material textures into ./assets/textures (run: node scripts/make-textures.mjs):
 * - wood.png: a dark walnut board, grain running across, for the desk at the foot of every page.
 * - paper.png: a tileable sheet texture (fibres, specks, soft mottling) laid over every paper surface (pages, cards,
 *   polaroids) as a faint overlay.
 * - leather.png: tileable pebbled leather grain, overlaid on leather controls.
 * Noise is computed here (seeded value noise), then encoded with CanvasKit (already installed with react-native-skia).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CanvasKitInit = require('canvaskit-wasm');
const CK = await CanvasKitInit({ locateFile: (file) => path.join(root, 'node_modules/canvaskit-wasm/bin', file) });
const out = path.join(root, 'assets', 'textures');
mkdirSync(out, { recursive: true });

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

/** Value noise on a lattice that wraps every `period` cells (so a texture built from it tiles). */
function makeNoise(seed, period = 256) {
  const rnd = seeded(seed);
  const table = Float32Array.from({ length: period * period }, () => rnd());
  const at = (x, y) => table[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * xf;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * xf;
    return a + (b - a) * yf;
  };
}

function fbm(noise, x, y, octaves, period) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise((x * f) % (period * f), (y * f) % (period * f));
    amp *= 0.5;
    f *= 2;
  }
  return v;
}

function save(width, height, pixels, file) {
  const img = CK.MakeImage({ width, height, alphaType: CK.AlphaType.Unpremul, colorType: CK.ColorType.RGBA_8888, colorSpace: CK.ColorSpace.SRGB }, pixels, width * 4);
  writeFileSync(path.join(out, file), img.encodeToBytes());
  console.log(`wrote assets/textures/${file}`);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// ─── Walnut: long flowing grain lines, darker latewood bands, fine pores along the grain, the odd soft knot. ───
{
  const W = 1200;
  const H = 420;
  const noise = makeNoise(11, 512);
  const fine = makeNoise(23, 512);
  const light = hex('#6E4628');
  const mid = hex('#4A2C17');
  const dark = hex('#2A170B');
  const px = new Uint8Array(W * H * 4);
  const knots = [
    [W * 0.22, H * 0.62, 38],
    [W * 0.71, H * 0.28, 26],
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Grain coordinate: mostly y, bent by slow noise, pulled round the knots.
      let warp = fbm(noise, x * 0.0035, y * 0.012, 4, 512) * 46;
      for (const [kx, ky, kr] of knots) {
        const dx = (x - kx) / (kr * 3.2);
        const dy = (y - ky) / kr;
        const d2 = dx * dx + dy * dy;
        warp += Math.exp(-d2) * kr * 0.9 * Math.sign(y - ky || 1);
      }
      const g = (y + warp) * 0.16;
      const band = 0.5 + 0.5 * Math.sin(g + fbm(noise, x * 0.01, y * 0.05, 2, 512) * 2.5);
      const late = Math.pow(band, 3.5);
      // Pores: short dark streaks along the grain.
      const pore = fine(x * 0.09, (y + warp) * 0.9) > 0.8 ? 0.35 : 0;
      const streak = fbm(fine, x * 0.004, (y + warp) * 0.35, 3, 512);
      let c = mix(mix(light, mid, 0.35 + streak * 0.6), dark, late * 0.75 + pore);
      for (const [kx, ky, kr] of knots) {
        const d = Math.hypot((x - kx) / 1.6, y - ky);
        if (d < kr) c = mix(c, dark, (1 - d / kr) * 0.7 * (0.6 + 0.4 * Math.sin(d * 0.9)));
      }
      const i = (y * W + x) * 4;
      px[i] = clamp(c[0]);
      px[i + 1] = clamp(c[1]);
      px[i + 2] = clamp(c[2]);
      px[i + 3] = 255;
    }
  }
  save(W, H, px, 'wood.png');
}

// ─── Paper: tileable, mostly transparent; darker where fibres and specks are, a faint cloudiness. ───
{
  const N = 512;
  const P = 64;
  const noise = makeNoise(5, P);
  const fine = makeNoise(9, 256);
  const rnd = seeded(77);
  const alpha = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cloud = fbm(noise, (x / N) * P * 0.12, (y / N) * P * 0.12, 3, P * 0.12 | 0 || 1);
      const tooth = fine((x / N) * 256, (y / N) * 256);
      alpha[y * N + x] = Math.max(0, cloud - 0.45) * 0.25 + Math.max(0, tooth - 0.55) * 0.35;
    }
  }
  // Fibres: thin short curves, wrapping at the edges so the tile repeats cleanly.
  for (let f = 0; f < 420; f++) {
    let x = rnd() * N;
    let y = rnd() * N;
    let a = rnd() * Math.PI * 2;
    const len = 8 + rnd() * 34;
    const strength = 0.12 + rnd() * 0.22;
    for (let s = 0; s < len; s++) {
      a += (rnd() - 0.5) * 0.35;
      x += Math.cos(a);
      y += Math.sin(a);
      const xi = ((Math.round(x) % N) + N) % N;
      const yi = ((Math.round(y) % N) + N) % N;
      alpha[yi * N + xi] += strength;
    }
  }
  // Specks.
  for (let s = 0; s < 260; s++) {
    const x = Math.floor(rnd() * N);
    const y = Math.floor(rnd() * N);
    const r = rnd() < 0.85 ? 0 : 1;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) alpha[(((y + dy) % N + N) % N) * N + (((x + dx) % N + N) % N)] += 0.35 + rnd() * 0.3;
  }
  const ink = hex('#5A4225');
  const px = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    px[i * 4] = ink[0];
    px[i * 4 + 1] = ink[1];
    px[i * 4 + 2] = ink[2];
    px[i * 4 + 3] = clamp(Math.min(1, alpha[i]) * 255);
  }
  save(N, N, px, 'paper.png');
}

// ─── Leather: tileable pebble grain (cells with dark creases between them and a lit top on each). ───
{
  const N = 256;
  const rnd = seeded(31);
  const cells = Array.from({ length: 1400 }, () => [rnd() * N, rnd() * N]);
  const px = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      let nx = 0;
      let ny = 0;
      for (const [cx, cy] of cells) {
        for (const ox of [-N, 0, N]) {
          for (const oy of [-N, 0, N]) {
            const dx = x - (cx + ox);
            const dy = y - (cy + oy);
            const d = dx * dx + dy * dy;
            if (d < d1) {
              d2 = d1;
              d1 = d;
              nx = dx;
              ny = dy;
            } else if (d < d2) d2 = d;
          }
        }
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const i = (y * N + x) * 4;
      if (edge < 1.1) {
        // The crease between pebbles.
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = clamp((1 - edge / 1.1) * 80);
      } else {
        // The pebble's top, lit from the top left.
        const lit = Math.max(0, (-nx - ny) / (Math.sqrt(d1) + 1) * 0.5);
        px[i] = 255;
        px[i + 1] = 245;
        px[i + 2] = 225;
        px[i + 3] = clamp(lit * 45);
      }
    }
  }
  save(N, N, px, 'leather.png');
}
