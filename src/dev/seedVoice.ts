import { writeVoiceBytes } from '../data/voiceStore';
import { mulberry32 } from '../lib/seeded';
import { shapeWaveform, WAVE_BARS } from '../lib/voice';

/** DEV ONLY. A few seconds of a hummed little tune, as a WAV file, so voice memories can be seeded. */
const RATE = 16000;
const NOTES = [262, 294, 330, 349, 392, 440, 494, 523];
/** Seconds of each hummed syllable, and the pause after it. */
const SYLLABLE = 0.32;
const GAP = 0.08;

export function generateSeedVoice(name: string, seed: number, seconds = 4): { path: string; wave: number[]; ms: number } {
  const rng = mulberry32(seed);
  const total = Math.round(RATE * seconds);
  const samples = new Int16Array(total);
  const step = SYLLABLE + GAP;
  for (let i = 0; i < total; i++) {
    const t = i / RATE;
    const k = Math.floor(t / step);
    const inSyllable = t - k * step;
    if (inSyllable > SYLLABLE) continue;
    // Each syllable gets a note and a loudness of its own, so the waveform has a shape.
    const noteRng = mulberry32(seed + k * 7919);
    const f = NOTES[Math.floor(noteRng() * NOTES.length)] ?? 330;
    const loud = 0.35 + noteRng() * 0.6;
    const env = Math.sin((Math.PI * inSyllable) / SYLLABLE);
    const v = (Math.sin(2 * Math.PI * f * t) * 0.7 + Math.sin(4 * Math.PI * f * t) * 0.2 + (rng() - 0.5) * 0.04) * env * loud;
    samples[i] = Math.round(Math.max(-1, Math.min(1, v)) * 32767 * 0.8);
  }
  // The waveform the recorder would have measured: the loudness of each 80 ms slice.
  const slice = Math.round(RATE * 0.08);
  const levels: number[] = [];
  for (let i = 0; i < total; i += slice) {
    let peak = 0;
    for (let j = i; j < Math.min(total, i + slice); j++) peak = Math.max(peak, Math.abs(samples[j] ?? 0));
    levels.push(peak / 32767);
  }
  const path = writeVoiceBytes(name, wavBytes(samples));
  return { path, wave: shapeWaveform(levels, WAVE_BARS), ms: Math.round(seconds * 1000) };
}

function wavBytes(samples: Int16Array): Uint8Array {
  const data = samples.length * 2;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, data, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return new Uint8Array(buf);
}
