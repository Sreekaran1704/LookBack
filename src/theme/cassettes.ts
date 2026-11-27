import type { IconState } from '../lib/appIcon';

/**
 * The cassette the person picks (You → Look): it is the app icon and every cassette in the app (home, the tape
 * recorder, memory pages, the intro, the widget). Pure, so it is tested in __tests__/cassettes.test.ts, and the icon
 * script (scripts/make-icons.mjs) draws each one from the same colors.
 *
 * `clear` shells are see-through: the tape packs, hubs, rollers and leader show through the plastic. The others are
 * solid plastic with a paper label and a window onto the tape.
 */
export type CassetteStyleId = 'clear' | 'retro' | 'black' | 'ivory' | 'blue' | 'metal';

/**
 * What the shell is made of, which is how it breaks as days go unwritten: clear styrene cracks and shatters like
 * glass; moulded plastic stress-whitens, snaps at a corner, then splits in two; metal scratches, dents, then crumples.
 */
export type CassetteMaterial = 'glass' | 'plastic' | 'metal';

export interface CassetteStyle {
  id: CassetteStyleId;
  material: CassetteMaterial;
  /** Short name under its swatch (≤ 6 letters). */
  name: string;
  /** One line about it, for the picker. */
  note: string;
  /** See-through plastic. */
  clear: boolean;
  /** The plastic: lit edge, body, shaded edge (top to bottom). */
  shell: [string, string, string];
  /** The shell's rim. */
  edge: string;
  /** The paper label and the ink written on it. */
  label: string;
  ink: string;
  /** The little side box ("A") on the label. */
  side: string;
  /** Printed stripes across the label, top to bottom, behind the window (empty: one thin line). */
  stripes: string[];
  /** The window onto the tape (solid shells). */
  window: string;
  /** Tape wound on the hubs. */
  tape: string;
  /** The corner rollers and the printed length box: the one bright color on it. */
  accent: string;
  /** The foot (the trapezoid at the bottom). */
  foot: string;
  /** Behind the launcher icon. */
  iconBackground: string;
}

export const CASSETTE_STYLES: readonly CassetteStyle[] = [
  {
    id: 'clear',
    material: 'glass',
    name: 'Clear',
    note: 'see-through, every part on show',
    clear: true,
    shell: ['#6E7074', '#585A5E', '#4A4C50'],
    edge: '#F2F2F2',
    label: '#FBF8F0',
    ink: '#1E2B55',
    side: '#1A1A1A',
    stripes: [],
    window: '#2B2D30',
    tape: '#0E0C0A',
    accent: '#D7261E',
    foot: '#5A5C60',
    iconBackground: '#0B0B0C',
  },
  {
    id: 'retro',
    material: 'plastic',
    name: 'Retro',
    note: '70s stripes on an old label',
    clear: false,
    shell: ['#3A342E', '#26221E', '#1A1714'],
    edge: '#5A524A',
    label: '#EFE3C8',
    ink: '#1F2A4A',
    side: '#2C2622',
    stripes: ['#E0A43A', '#D07A2E', '#B5482A', '#7B3A22'],
    window: '#1C1612',
    tape: '#5A3720',
    accent: '#B5482A',
    foot: '#2B2723',
    iconBackground: '#EFE2C4',
  },
  {
    id: 'black',
    material: 'plastic',
    name: 'Black',
    note: 'the classic black tape',
    clear: false,
    shell: ['#2E2E31', '#1C1C1E', '#121213'],
    edge: '#3A3A3D',
    label: '#F4F1EA',
    ink: '#23304A',
    side: '#4A2A3A',
    stripes: ['#C8372B'],
    window: '#2A211C',
    tape: '#4A2E1F',
    accent: '#C8372B',
    foot: '#141416',
    iconBackground: '#1F3D2C',
  },
  {
    id: 'ivory',
    material: 'plastic',
    name: 'Ivory',
    note: 'cream plastic, mustard label',
    clear: false,
    shell: ['#FBF6EA', '#EFE5CF', '#DCCDAA'],
    edge: '#C9B98F',
    label: '#E2A63B',
    ink: '#3A2410',
    side: '#7A3A1E',
    stripes: ['#C8452F'],
    window: '#2A1E16',
    tape: '#4A2E1F',
    accent: '#C8452F',
    foot: '#D8C8A6',
    iconBackground: '#1E2A44',
  },
  {
    id: 'blue',
    material: 'glass',
    name: 'Blue',
    note: 'tinted see-through, 90s',
    clear: true,
    shell: ['#5A8CC4', '#3F6FA6', '#2D5384'],
    edge: '#D6E6F8',
    label: '#FBF8F0',
    ink: '#1E2B55',
    side: '#1E3F6E',
    stripes: [],
    window: '#24476F',
    tape: '#0C0B0A',
    accent: '#F2F2F2',
    foot: '#3A6194',
    iconBackground: '#E9EEF4',
  },
  {
    id: 'metal',
    material: 'metal',
    name: 'Metal',
    note: 'brushed metal, gold lettering',
    clear: false,
    shell: ['#E4E5E7', '#B9BCC0', '#8E9196'],
    edge: '#F6F6F7',
    label: '#16161A',
    ink: '#E2C178',
    side: '#B8893E',
    stripes: ['#B8893E'],
    window: '#141418',
    tape: '#3A2A1E',
    accent: '#B8893E',
    foot: '#7E8186',
    iconBackground: '#101012',
  },
];

/** The cassette everyone starts with (1.3.3: the metal one); anyone can pick another in You → Look. */
export const DEFAULT_CASSETTE: CassetteStyleId = 'metal';

export function cassetteStyle(id: string | null | undefined): CassetteStyle {
  return CASSETTE_STYLES.find((s) => s.id === id) ?? (CASSETTE_STYLES.find((s) => s.id === DEFAULT_CASSETTE) as CassetteStyle);
}

export function isCassetteStyleId(id: unknown): id is CassetteStyleId {
  return typeof id === 'string' && CASSETTE_STYLES.some((s) => s.id === id);
}

/**
 * The launcher alias for a style in a state (`expo-alternate-app-icons` names, see app.json). The clear cassette, whole,
 * is the app's main icon (null); its cracked states keep their first names (Waiting, Missed, Gone) so phones that already
 * switched to one keep working; every other style is its name then its state ("RetroDefault", "RetroMissed").
 */
export function iconNameFor(style: CassetteStyleId, state: IconState): string | null {
  if (style === 'clear') return state === 'Default' ? null : state;
  return `${style.charAt(0).toUpperCase()}${style.slice(1)}${state}`;
}

/** Every alternate icon name, in the order app.json lists them. */
export function alternateIconNames(): string[] {
  const states: IconState[] = ['Default', 'Waiting', 'Missed', 'Gone'];
  return CASSETTE_STYLES.flatMap((s) => states.map((st) => iconNameFor(s.id, st))).filter((n): n is string => n !== null);
}
