/**
 * Makes the tape recorder's sounds (mono 16-bit WAV, 44.1 kHz) into assets/sounds/:
 *   tape-clunk.wav  a piano key going down: a short mechanical knock with a low thump
 *   tape-start.wav  the motor spinning up under the capstan, settling into a steady hum
 *   tape-stop.wav   the motor winding down
 *   tape-hiss.wav   two seconds of soft tape hiss with a slow wow, made to loop without a seam
 *   tape-screech-start.wav  the tape catching on the head as it gets up to speed: a short rising, wavering squeal
 *   tape-screech-end.wav    the same as it runs out and drags to a stop: a falling squeal and a scrape
 * Run: node scripts/make-tape-sounds.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 44100;
const OUT = join(import.meta.dirname, '..', 'assets', 'sounds');

/** A tiny seeded random, so the files come out the same every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** One-pole filters, enough for shaping noise. */
function lowpass(x, cutoff) {
  const a = Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  return x.map((v) => (y = (1 - a) * v + a * y));
}
function highpass(x, cutoff) {
  const low = lowpass(x, cutoff);
  return x.map((v, i) => v - low[i]);
}
function normalize(x, peak) {
  const m = x.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1;
  return x.map((v) => (v / m) * peak);
}

function clunk() {
  const n = Math.round(RATE * 0.16);
  const r = rng(7);
  const noise = Array.from({ length: n }, () => r() * 2 - 1);
  const knock = highpass(lowpass(noise, 2400), 500).map((v, i) => v * Math.exp(-i / (RATE * 0.012)));
  const thump = Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    const f = 120 * Math.exp(-t * 18) + 48;
    return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 38);
  });
  // A second, lighter click as the key latches.
  const latch = Array.from({ length: n }, (_, i) => {
    const j = i - Math.round(RATE * 0.045);
    return j < 0 ? 0 : (r() * 2 - 1) * Math.exp(-j / (RATE * 0.004)) * 0.35;
  });
  return normalize(knock.map((v, i) => v * 0.8 + thump[i] * 0.9 + latch[i]), 0.9);
}

function motor(up) {
  const seconds = up ? 0.7 : 0.45;
  const n = Math.round(RATE * seconds);
  const r = rng(up ? 11 : 13);
  let phase = 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const p = t / seconds;
    const speed = up ? 1 - Math.exp(-p * 5) : Math.exp(-p * 4);
    const f = 22 + 38 * speed;
    phase += (2 * Math.PI * f) / RATE;
    // A rough hum (a few harmonics) and a little mechanical grit, fading in or out with the speed.
    const hum = Math.sin(phase) * 0.5 + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3) * 0.15;
    // The short, uneven scrape of the leader crossing the head, before/after the voice.
    const leader = Math.exp(-p * (up ? 18 : 9)) * (0.35 + 0.65 * Math.abs(Math.sin(t * 173)));
    const grit = (r() * 2 - 1) * (0.12 + leader * 1.6);
    const env = up ? Math.min(1, p * 6) * (1 - Math.max(0, p - 0.85) / 0.15 * 0.3) : speed;
    out.push((hum + grit) * env * speed);
  }
  return normalize(lowpass(out, 900), 0.35);
}

function hiss() {
  const n = RATE * 2;
  const r = rng(17);
  const raw = highpass(lowpass(Array.from({ length: n }, () => r() * 2 - 1), 9000), 2200);
  // A slow wow, one cycle across the file so the loop has no seam.
  const wowed = raw.map((v, i) => v * (0.85 + 0.15 * Math.sin((2 * Math.PI * i) / n)));
  // Cross-fade the end into the start, so looping it never clicks.
  const fade = Math.round(RATE * 0.08);
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    wowed[i] = wowed[i] * w + wowed[n - fade + i] * (1 - w);
  }
  return normalize(wowed.slice(0, n - fade), 0.5);
}

/**
 * Tape squealing over the head: a thin whistle that wavers (the tape stick-slipping), with the scrape of the tape's
 * oxide under it. `up` rises as the tape gets up to speed; otherwise it falls and drags to a stop.
 */
function screech(up) {
  const seconds = up ? 0.34 : 0.48;
  const n = Math.round(RATE * seconds);
  const r = rng(up ? 23 : 29);
  const scrape = highpass(lowpass(Array.from({ length: n }, () => r() * 2 - 1), 6000), 1800);
  let phase = 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const p = t / seconds;
    // The pitch sweeps (up or down) and wavers as the tape grabs and lets go.
    const sweep = up ? 1500 + 1400 * Math.pow(p, 0.6) : 2900 - 1900 * Math.pow(p, 0.8);
    const waver = 1 + 0.035 * Math.sin(2 * Math.PI * 23 * t) + 0.02 * Math.sin(2 * Math.PI * 61 * t);
    phase += (2 * Math.PI * sweep * waver) / RATE;
    const stick = 0.55 + 0.45 * Math.abs(Math.sin(2 * Math.PI * (up ? 31 : 17) * t));
    const whistle = (Math.sin(phase) * 0.7 + Math.sin(phase * 2.01) * 0.2) * stick;
    // In fast, out with a tail; the end one drags off with more scrape.
    const env = up ? Math.min(1, p * 12) * Math.pow(1 - p, 0.7) : Math.min(1, p * 20) * Math.pow(1 - p, 1.3);
    out.push((whistle * 0.75 + scrape[i] * (up ? 0.35 : 0.6)) * env);
  }
  return normalize(out, up ? 0.32 : 0.36);
}

writeFileSync(join(OUT, 'tape-screech-start.wav'), wav(screech(true)));
writeFileSync(join(OUT, 'tape-screech-end.wav'), wav(screech(false)));
writeFileSync(join(OUT, 'tape-clunk.wav'), wav(clunk()));
writeFileSync(join(OUT, 'tape-start.wav'), wav(motor(true)));
writeFileSync(join(OUT, 'tape-stop.wav'), wav(motor(false)));
writeFileSync(join(OUT, 'tape-hiss.wav'), wav(hiss()));
console.log('Wrote tape-clunk, tape-start, tape-stop and tape-hiss to assets/sounds/');
