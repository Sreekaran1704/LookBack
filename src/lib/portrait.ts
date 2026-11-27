/**
 * A person's portrait (the little film-frame picture of them on the You and Shared pages): the choices they made in the
 * portrait maker, a short code that carries them to the people they give pages to, and a default for anyone who hasn't
 * made one. Every option is open to everyone; nothing is grouped by gender. Pure module (no React Native imports).
 *
 * The code is `p` + one base-36 digit per part, in PART_KEYS order. Parts are only ever appended (an older code just
 * lacks the newer parts, which read as 0), and options are only ever appended to a part, so a code never changes
 * meaning between app versions.
 */

export const PORTRAIT_OPTIONS = {
  face: ['oval', 'round', 'square', 'long', 'heart'],
  build: ['slim', 'medium', 'broad'],
  /** 12 skin tones, very fair to very deep (the colors live with the drawing). */
  skin: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  eyes: ['round', 'almond', 'monolid', 'hooded'],
  eyeColor: ['dark brown', 'brown', 'hazel', 'green', 'blue', 'grey'],
  lashes: ['none', 'lashes'],
  brows: ['thin', 'straight', 'arched', 'thick'],
  nose: ['small', 'button', 'broad', 'long'],
  mouth: ['smile', 'grin', 'neutral', 'smirk'],
  blush: ['none', 'blush'],
  hair: [
    'bald', 'buzz', 'crop', 'side part', 'quiff', 'fade', 'mullet', 'bob', 'waves', 'long', 'long curly', 'ponytail',
    'bun', 'top knot', 'afro', 'coils', 'twist-out', 'locs', 'box braids', 'cornrows',
  ],
  hairColor: ['black', 'dark brown', 'brown', 'chestnut', 'light brown', 'honey', 'blonde', 'auburn', 'grey', 'white', 'pink', 'blue'],
  beard: ['none', 'stubble', 'moustache', 'goatee', 'short beard', 'full beard'],
  cover: ['none', 'hijab', 'turban', 'headwrap', 'kippah', 'beret', 'flat cap', 'beanie', 'cap'],
  top: ['tee', 'hoodie', 'shirt', 'blazer'],
  topColor: ['oxblood', 'bottle', 'navy', 'plum', 'tobacco', 'charcoal'],
  accessory: ['none', 'glasses', 'round specs', 'pearls', 'earrings', 'stud', 'nose ring', 'bindi', 'flower', 'bow'],
  film: ['Sepia', 'Silver', 'Kodachrome', 'Lamplight'],
} as const;

export type PortraitPart = keyof typeof PORTRAIT_OPTIONS;
export type Portrait = Record<PortraitPart, number>;

/** The order parts are written in a code. Append only. */
export const PART_KEYS: readonly PortraitPart[] = [
  'face', 'build', 'skin', 'eyes', 'eyeColor', 'lashes', 'brows', 'nose', 'mouth', 'blush', 'hair', 'hairColor', 'beard',
  'cover', 'top', 'topColor', 'accessory', 'film',
];

/** The maker's sections, in the order they're shown, with their headings. */
export const PORTRAIT_SECTIONS: readonly { part: PortraitPart; label: string; swatch?: boolean }[] = [
  { part: 'skin', label: 'Skin', swatch: true },
  { part: 'face', label: 'Face' },
  { part: 'build', label: 'Build' },
  { part: 'hair', label: 'Hair' },
  { part: 'hairColor', label: 'Hair colour', swatch: true },
  { part: 'beard', label: 'Facial hair' },
  { part: 'eyes', label: 'Eyes' },
  { part: 'eyeColor', label: 'Eye colour', swatch: true },
  { part: 'lashes', label: 'Lashes' },
  { part: 'brows', label: 'Brows' },
  { part: 'nose', label: 'Nose' },
  { part: 'mouth', label: 'Mouth' },
  { part: 'blush', label: 'Blush' },
  { part: 'cover', label: 'Head covering' },
  { part: 'top', label: 'Top' },
  { part: 'topColor', label: 'Top colour', swatch: true },
  { part: 'accessory', label: 'Accessory' },
  { part: 'film', label: 'Film' },
];

/**
 * The maker's tabs, so it's a few short lists instead of one long one: each holds some of PORTRAIT_SECTIONS, in order.
 */
export const PORTRAIT_TABS: readonly { key: string; label: string; parts: readonly PortraitPart[] }[] = [
  { key: 'face', label: 'Face', parts: ['skin', 'face', 'build', 'nose', 'mouth', 'blush'] },
  { key: 'eyes', label: 'Eyes', parts: ['eyes', 'eyeColor', 'lashes', 'brows'] },
  { key: 'hair', label: 'Hair', parts: ['hair', 'hairColor', 'beard', 'cover'] },
  { key: 'style', label: 'Style', parts: ['top', 'topColor', 'accessory', 'film'] },
];

/**
 * A passing face the little portrait pulls when you change something: `wow` (round mouth, eyebrows up), `wink`,
 * `joy` (eyes closed in a smile), `blink`. Drawn over the chosen eyes / mouth for a moment, never saved.
 */
export type PortraitExpression = 'wow' | 'wink' | 'joy' | 'blink';

/** Which parts differ between two portraits. */
export function changedParts(a: Portrait, b: Portrait): PortraitPart[] {
  return PART_KEYS.filter((k) => a[k] !== b[k]);
}

/**
 * How the portrait reacts to a change: a new look all at once (Surprise) or new hair / head covering → wow; eyes,
 * lashes, brows → a wink; clothes, accessory, film, skin, face → joy; a new mouth → none (so you see the mouth you
 * picked), anything else → a blink. Null when nothing changed.
 */
export function reactionTo(before: Portrait, after: Portrait): PortraitExpression | null {
  const parts = changedParts(before, after);
  if (parts.length === 0) return null;
  if (parts.length > 2) return 'wow';
  const part = parts[0]!;
  if (part === 'mouth') return null;
  if (part === 'hair' || part === 'hairColor' || part === 'cover') return 'wow';
  if (part === 'eyes' || part === 'eyeColor' || part === 'lashes' || part === 'brows') return 'wink';
  if (part === 'top' || part === 'topColor' || part === 'accessory' || part === 'film' || part === 'skin' || part === 'face' || part === 'blush') return 'joy';
  return 'blink';
}

const CODE_PREFIX = 'p';
const RADIX = 36;
/** The film a default portrait is shot on (warm colour reads best at list size). */
const DEFAULT_FILM = 2;

export function encodePortrait(p: Portrait): string {
  return CODE_PREFIX + PART_KEYS.map((k) => p[k].toString(RADIX)).join('');
}

/** Reads a code (from this phone or another): null when it isn't one, or names an option that doesn't exist. */
export function parsePortrait(code: unknown): Portrait | null {
  if (typeof code !== 'string' || !code.startsWith(CODE_PREFIX)) return null;
  const digits = code.slice(CODE_PREFIX.length);
  if (digits.length === 0 || digits.length > PART_KEYS.length || !/^[0-9a-z]+$/.test(digits)) return null;
  const p = {} as Portrait;
  for (let i = 0; i < PART_KEYS.length; i++) {
    const key = PART_KEYS[i] as PortraitPart;
    const value = i < digits.length ? parseInt(digits[i] as string, RADIX) : 0;
    if (value >= PORTRAIT_OPTIONS[key].length) return null;
    p[key] = value;
  }
  return p;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A small seeded generator (mulberry32), so a name always makes the same portrait. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A whole portrait from a random source. Every part can be anything; the extras (facial hair, a head covering, an
 * accessory, lashes, blush) are left off more often than not, so a crowd looks like people rather than costumes.
 */
export function randomPortrait(random: () => number = Math.random): Portrait {
  const pick = (k: PortraitPart) => Math.floor(random() * PORTRAIT_OPTIONS[k].length);
  const sometimes = (k: PortraitPart, chance: number) => (random() < chance ? pick(k) : 0);
  return {
    face: pick('face'),
    build: pick('build'),
    skin: pick('skin'),
    eyes: pick('eyes'),
    eyeColor: pick('eyeColor'),
    lashes: sometimes('lashes', 0.4),
    brows: pick('brows'),
    nose: pick('nose'),
    mouth: pick('mouth'),
    blush: sometimes('blush', 0.4),
    hair: pick('hair'),
    hairColor: pick('hairColor'),
    beard: sometimes('beard', 0.5),
    cover: sometimes('cover', 0.3),
    top: pick('top'),
    topColor: pick('topColor'),
    accessory: sometimes('accessory', 0.6),
    film: DEFAULT_FILM,
  };
}

/** The portrait someone has until they make their own: always the same one for the same name. */
export function defaultPortrait(name: string): Portrait {
  return randomPortrait(seeded(hash(name.trim().toLowerCase() || 'someone')));
}

/** The portrait to draw for someone: theirs if their code reads, otherwise the default for their name. */
export function portraitFor(code: string | null | undefined, name: string): Portrait {
  return parsePortrait(code) ?? defaultPortrait(name);
}

/** Head coverings that hide the hair (and, for a hijab, the ears and neck). */
export function coversHair(p: Portrait): boolean {
  const cover = PORTRAIT_OPTIONS.cover[p.cover];
  return cover === 'hijab' || cover === 'turban' || cover === 'headwrap';
}

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Sepia: the colour's lightness laid between a deep brown and a warm cream. */
const SEPIA_DARK = [58, 36, 20];
const SEPIA_LIGHT = [242, 226, 196];
/** Lamplight: everything warmed a little toward lamp gold. */
const LAMP = [201, 164, 92];
const LAMP_MIX = 0.12;

/**
 * How a film stock turns a colour: Sepia and Silver keep only its lightness (brown-toned or grey); Kodachrome keeps the
 * colour; Lamplight warms it toward lamp gold. Applied to every colour in the portrait, so no image filter is needed.
 */
export function filmTone(film: number, hex: string): string {
  const stock = PORTRAIT_OPTIONS.film[film] ?? 'Kodachrome';
  if (!/^#[0-9a-fA-F]{6}$/.test(hex) || stock === 'Kodachrome') return hex;
  const r = channel(hex, 0);
  const g = channel(hex, 1);
  const b = channel(hex, 2);
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (stock === 'Silver') return toHex(y * 255, y * 255, y * 255);
  if (stock === 'Sepia') {
    const [dr, dg, db] = SEPIA_DARK as [number, number, number];
    const [lr, lg, lb] = SEPIA_LIGHT as [number, number, number];
    return toHex(dr + (lr - dr) * y, dg + (lg - dg) * y, db + (lb - db) * y);
  }
  const [lr, lg, lb] = LAMP as [number, number, number];
  return toHex(r + (lr - r) * LAMP_MIX, g + (lg - g) * LAMP_MIX, b + (lb - b) * LAMP_MIX);
}
