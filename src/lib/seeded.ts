/**
 * Deterministic randomness so every entry looks different but stays the same across renders.
 * Pure module (no React Native imports).
 */

export type ObjectType = 'polaroid' | 'tapedPhoto' | 'tornNote' | 'ticket';
export type TapePattern = 'stripes' | 'dots' | 'floral' | 'grid' | 'zigzag';
export type StickerKind = 'star' | 'heart' | 'sun' | 'moon' | 'smiley';
export type Fastener = 'tape' | 'clip' | 'pin';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export const OBJECT_TYPES: readonly ObjectType[] = ['polaroid', 'tapedPhoto', 'tornNote', 'ticket'];
export const TAPE_PATTERNS: readonly TapePattern[] = ['stripes', 'dots', 'floral', 'grid', 'zigzag'];
export const STICKERS: readonly StickerKind[] = ['star', 'heart', 'sun', 'moon', 'smiley'];

/** Texts at or under this length may become ticket stubs. */
export const TICKET_MAX_CHARS = 70;
const TICKET_CHANCE_QUOTE = 0.85;
const TICKET_CHANCE_NOTE = 0.2;

/** 32-bit FNV-1a hash. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next: () => number;
  range: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
}

export function seededRng(seed: string): Rng {
  const next = mulberry32(hashString(seed));
  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick() needs a non-empty list');
      return item;
    },
    chance: (p) => next() < p,
  };
  return rng;
}

export interface LookInput {
  id: string;
  text: string;
  photoPath: string | null;
  objectType?: string | null;
  tapePattern?: string | null;
  sticker?: string | null;
  tapeColor?: string | null;
}

export interface EntryLook {
  objectType: ObjectType;
  tapePattern: TapePattern;
  sticker: StickerKind | null;
  fastener: Fastener;
  /** Degrees, within ±maxTilt. */
  tilt: number;
  offsetX: number;
  offsetY: number;
  tapeAngle: number;
  stickerCorner: Corner;
  stickerTilt: number;
  /** Torn notes sometimes get a folded corner. */
  folded: boolean;
  /** 0..1 used to vary sizes in collages. */
  sizeJitter: number;
  /** Seed for wobbly paths (torn edges, doodles). */
  pathSeed: number;
}

const isObjectType = (v: unknown): v is ObjectType => OBJECT_TYPES.includes(v as ObjectType);
const isTape = (v: unknown): v is TapePattern => TAPE_PATTERNS.includes(v as TapePattern);
const isSticker = (v: unknown): v is StickerKind => STICKERS.includes(v as StickerKind);

export function objectTypeFits(type: ObjectType, hasPhoto: boolean): boolean {
  const photoType = type === 'polaroid' || type === 'tapedPhoto';
  return photoType === hasPhoto;
}

/**
 * The scrapbook look for an entry. Stored style fields win when they are valid and fit the
 * content (a photo object needs a photo); otherwise everything comes from the id seed.
 * `sticker: 'none'` stored on the entry means "no sticker".
 */
export function lookForEntry(entry: LookInput, maxTilt = 4, maxOffset = 10): EntryLook {
  const rng = seededRng(entry.id);
  const hasPhoto = entry.photoPath !== null && entry.photoPath !== '';
  const trimmed = entry.text.trim();
  const short = trimmed.length <= TICKET_MAX_CHARS;
  const quote = /^["“'‘]/.test(trimmed);

  // Always draw every value in the same order so overrides don't shift the rest of the look.
  const typeRoll = rng.next();
  let seededType: ObjectType;
  if (hasPhoto) seededType = typeRoll < 0.6 ? 'polaroid' : 'tapedPhoto';
  // Tickets are for short quotes; other short notes only occasionally become tickets.
  else seededType = short && typeRoll < (quote ? TICKET_CHANCE_QUOTE : TICKET_CHANCE_NOTE) ? 'ticket' : 'tornNote';
  const seededTape = rng.pick(TAPE_PATTERNS);
  const hasSticker = rng.chance(0.6);
  const seededSticker = rng.pick(STICKERS);
  const fastenerRoll = rng.next();
  const tilt = rng.range(-maxTilt, maxTilt);
  const offsetX = rng.range(-maxOffset, maxOffset);
  const offsetY = rng.range(-maxOffset / 2, maxOffset / 2);
  const tapeAngle = rng.range(-8, 8);
  const stickerCorner = rng.pick<Corner>(['tl', 'tr', 'bl', 'br']);
  const stickerTilt = rng.range(-18, 18);
  const folded = rng.chance(0.4);
  const sizeJitter = rng.next();
  const pathSeed = Math.floor(rng.next() * 1_000_000);

  const objectType =
    isObjectType(entry.objectType) && objectTypeFits(entry.objectType, hasPhoto) ? entry.objectType : seededType;

  let sticker: StickerKind | null;
  if (entry.sticker === 'none') sticker = null;
  else if (isSticker(entry.sticker)) sticker = entry.sticker;
  else sticker = hasSticker ? seededSticker : null;

  let fastener: Fastener;
  // A tape the person picked (pattern or color) must be visible, so it holds the object.
  const tapeChosen = isTape(entry.tapePattern) || (typeof entry.tapeColor === 'string' && entry.tapeColor.length > 0);
  if (objectType === 'tapedPhoto' || tapeChosen) fastener = 'tape';
  else if (objectType === 'polaroid') fastener = fastenerRoll < 0.5 ? 'tape' : fastenerRoll < 0.75 ? 'clip' : 'pin';
  else if (objectType === 'tornNote') fastener = fastenerRoll < 0.4 ? 'pin' : fastenerRoll < 0.8 ? 'tape' : 'clip';
  else fastener = fastenerRoll < 0.7 ? 'tape' : 'pin';

  return {
    objectType,
    tapePattern: isTape(entry.tapePattern) ? entry.tapePattern : seededTape,
    sticker,
    fastener,
    tilt,
    offsetX,
    offsetY,
    tapeAngle,
    stickerCorner,
    stickerTilt,
    folded: objectType === 'tornNote' && folded,
    sizeJitter,
    pathSeed,
  };
}

/** A ragged edge: `count` points with seeded jitter, as y offsets in [0, amplitude]. */
export function raggedOffsets(seed: number, count: number, amplitude: number): number[] {
  const next = mulberry32(seed);
  return Array.from({ length: count }, () => next() * amplitude);
}
