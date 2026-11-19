/**
 * Voice memories: how a recording's loudness becomes the little waveform drawn on the paper, and how
 * long a voice note may be. Pure (no React Native), unit-tested in __tests__/voice.test.ts.
 *
 * The waveform is measured while recording (the recorder's level meter, in dBFS) and saved with the
 * memory, so drawing it never has to read the audio file.
 */

/** A voice memory is a small thing, like the rest of the day's page. */
export const VOICE_MAX_MS = 60_000;
/** Bars in a saved waveform (drawn at every size, so a fixed count). */
export const WAVE_BARS = 32;
/** Quietest level that still shows (dBFS); anything below draws as the shortest bar. */
const FLOOR_DB = -50;
/** The shortest bar, so silence still reads as a waveform rather than a gap. */
export const MIN_BAR = 0.08;

/** A meter reading in dBFS (-160 = silence … 0 = loudest) as 0–1. */
export function levelFromDb(db: number | null | undefined): number {
  if (db === null || db === undefined || !Number.isFinite(db)) return 0;
  const t = (db - FLOOR_DB) / -FLOOR_DB;
  return Math.max(0, Math.min(1, t));
}

/**
 * The levels sampled while recording, squeezed (or stretched) into `bars` bars: each bar is the
 * loudest moment of its slice, scaled so the loudest bar is full height, never below MIN_BAR.
 */
export function shapeWaveform(levels: readonly number[], bars = WAVE_BARS): number[] {
  if (bars <= 0) return [];
  if (levels.length === 0) return Array.from({ length: bars }, () => MIN_BAR);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    let peak = 0;
    for (let j = from; j < to && j < levels.length; j++) peak = Math.max(peak, levels[j] ?? 0);
    out.push(peak);
  }
  const loudest = Math.max(...out);
  return out.map((v) => round2(Math.max(MIN_BAR, loudest > 0 ? v / loudest : 0)));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Stored in the database as JSON text. */
export function encodeWave(wave: readonly number[] | null): string | null {
  return wave && wave.length > 0 ? JSON.stringify(wave.map(round2)) : null;
}

/** Reads a stored waveform; anything unreadable becomes null (the note then draws a flat line). */
export function parseWave(raw: unknown): number[] | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  const wave = value.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : MIN_BAR));
  return wave;
}

/** "0:07", "1:00". */
export function formatVoiceMs(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
