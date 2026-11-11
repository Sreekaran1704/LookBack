/**
 * The page colors a person can choose for their notebook, each in a light and a dark tone. Dark is the
 * same paper by lamplight (a deep shade of the same color), not black. Paper objects (notes, polaroids,
 * panels) stay light on either tone. Pure module (no React Native imports) so it can be unit-tested.
 */
export type PaperTone = 'light' | 'dark';

export interface Paper {
  name: string;
  label: string;
  /** The page in the light tone, and a slightly deeper shade of it. */
  light: string;
  lightDeep: string;
  /** The same paper in the dark tone. */
  dark: string;
  darkDeep: string;
  /** The dot grid printed on the page (light tone; the dark tone uses pale dots). */
  dots: string;
}

export const PAPERS: readonly Paper[] = [
  { name: 'cream', label: 'Cream', light: '#FBF5E6', lightDeep: '#ECE2CA', dark: '#2A251E', darkDeep: '#1B1814', dots: '#5B8CC9' },
  { name: 'peach', label: 'Peach', light: '#FFE9E1', lightDeep: '#F6D3C6', dark: '#3B2722', darkDeep: '#261915', dots: '#F29A86' },
  { name: 'rose', label: 'Rose', light: '#FCE4EC', lightDeep: '#F3CCDA', dark: '#3A2030', darkDeep: '#25141F', dots: '#E57BA2' },
  { name: 'lemon', label: 'Lemon', light: '#FBF3CC', lightDeep: '#F0E3A8', dark: '#35301A', darkDeep: '#221E10', dots: '#D9A521' },
  { name: 'mint', label: 'Mint', light: '#E2F5EA', lightDeep: '#C9EAD7', dark: '#1D3429', darkDeep: '#12221A', dots: '#3FAF7C' },
  { name: 'sky', label: 'Sky', light: '#E1EEFB', lightDeep: '#C8DDF4', dark: '#1C2B3E', darkDeep: '#111B28', dots: '#4D8DD6' },
  { name: 'lavender', label: 'Lavender', light: '#ECE6FA', lightDeep: '#DAD0F3', dark: '#2A2440', darkDeep: '#1B172A', dots: '#8B6FD9' },
];

export const DEFAULT_PAPER = 'cream';

export interface Look {
  paper: string;
  tone: PaperTone;
}

export const DEFAULT_LOOK: Look = { paper: DEFAULT_PAPER, tone: 'light' };

export function paperByName(name: string | null | undefined): Paper {
  return PAPERS.find((p) => p.name === name) ?? (PAPERS[0] as Paper);
}

/** Reads a stored look, tolerating missing or old values (the old setting was just 'system' | 'light' | 'dark'). */
export function parseLook(raw: string | null | undefined): Look {
  if (!raw) return DEFAULT_LOOK;
  if (raw === 'dark' || raw === 'light') return { paper: DEFAULT_PAPER, tone: raw };
  try {
    const value = JSON.parse(raw) as Partial<Look>;
    return {
      paper: PAPERS.some((p) => p.name === value.paper) ? (value.paper as string) : DEFAULT_PAPER,
      tone: value.tone === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return DEFAULT_LOOK;
  }
}
