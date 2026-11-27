/**
 * The home-screen widget's cassette, as one SVG (the widget host can only draw images, text and SVG). Pure: no React
 * Native imports, tested in __tests__/cassetteSvg.test.ts.
 *
 * A realistic compact cassette in the app's proportions (100 × 63): black shell, cream paper label with the "A" box, a red
 * stripe, the smoked window onto two tape packs and white toothed hubs, the band, the trapezoid with its holes, five
 * screws. The label carries today in handwriting. It breaks like the app icon: a hairline crack while today is waiting,
 * cracks and a chip after a missed day, shattered after days away. When a past year has come back, a red "a letter
 * waiting" postmark is struck across the corner.
 */
import type { IconState } from '../lib/appIcon';
import { cassetteStyle, type CassetteStyle } from '../theme/cassettes';

export interface CassetteSvgOptions {
  /** Handwritten on the label's first line ("Nov 21 · Saturday"). */
  title: string;
  /** Handwritten on the label's second line: today's first words, or a nudge. */
  line: string;
  /** Printed on the band, right ("C·365", or the streak). */
  detail: string;
  state: IconState;
  /** Pages from past years that came back today (0 = no postmark). */
  letters: number;
  /** How much tape has wound onto the right reel (0–1): the year so far. */
  played: number;
  /** Font families registered for the widget. */
  hand: string;
  print: string;
  /** The person's cassette (You → Look); the classic black one if left out. */
  style?: CassetteStyle;
}

const W = 100;
const H = 63;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A short seeded random, so the cracks are the same on every draw. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A jagged crack from (x, y), wandering out `arms` ways. */
function crack(x: number, y: number, arms: number, reach: number, rnd: () => number): string {
  let d = '';
  for (let a = 0; a < arms; a++) {
    let angle = (a / arms) * Math.PI * 2 + rnd() * 0.9;
    let px = x;
    let py = y;
    d += `M${px.toFixed(1)} ${py.toFixed(1)}`;
    const steps = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < steps; i++) {
      angle += (rnd() - 0.5) * 0.9;
      const len = reach * (0.3 + rnd() * 0.5);
      px += Math.cos(angle) * len;
      py += Math.sin(angle) * len;
      d += ` L${px.toFixed(1)} ${py.toFixed(1)}`;
    }
  }
  return d;
}

function crackLayer(state: IconState): string {
  if (state === 'Default') return '';
  const rnd = seeded(state === 'Gone' ? 77 : state === 'Missed' ? 31 : 13);
  let d = '';
  if (state === 'Waiting') {
    // A hairline from the top right corner.
    d = 'M98 2 L93 7 L94.5 9 L89 14 L90 16.5 L85 21';
  } else if (state === 'Missed') {
    d = crack(60, 34, 7, 6, rnd);
  } else {
    d = crack(56, 33, 10, 9, rnd) + crack(24, 30, 5, 6, rnd) + crack(80, 48, 5, 6, rnd);
  }
  const chip =
    state === 'Missed'
      ? '<path d="M59 33 L61.5 32.4 L62.4 34.6 L60 35.6 Z" fill="#050506" stroke="#D8D8DE" stroke-opacity="0.5" stroke-width="0.2"/>'
      : state === 'Gone'
        ? '<path d="M54 31 L58.5 30.4 L59.6 34.6 L55.6 36.2 L53 34 Z" fill="#050506" stroke="#D8D8DE" stroke-opacity="0.5" stroke-width="0.2"/><path d="M22.6 28.6 L25.6 28.2 L25 31 Z" fill="#050506"/><path d="M79 47 L82 46.5 L81.4 49.4 Z" fill="#050506"/>'
        : '';
  return `<g clip-path="url(#shell)"><path d="${d}" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="0.5" stroke-linejoin="round" transform="translate(0.25 0.3)"/><path d="${d}" fill="none" stroke="#E6E6EC" stroke-opacity="0.75" stroke-width="0.22" stroke-linejoin="round"/>${chip}</g>`;
}

/** A tape pack wound on a hub (radius by how much is on it) and the white toothed hub turning on it. */
function reel(cx: number, r: number): string {
  const teeth = [0, 60, 120].map((a) => `<rect x="${cx - 0.6}" y="${31 - 4.9}" width="1.2" height="9.8" fill="#F2F2F0" transform="rotate(${a + 15} ${cx} 31)"/>`).join('');
  return `<circle cx="${cx}" cy="31" r="${r.toFixed(1)}" fill="url(#tape)"/><circle cx="${cx}" cy="31" r="7.5" fill="#F2F2F0"/><circle cx="${cx}" cy="31" r="7.2" fill="none" stroke="#BDBDBB" stroke-width="0.6"/><circle cx="${cx}" cy="31" r="3.6" fill="#1A1A1A"/>${teeth}`;
}

function screw(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="1.8" fill="url(#screw)"/><rect x="${x - 1.2}" y="${y - 0.25}" width="2.4" height="0.5" fill="#444" transform="rotate(45 ${x} ${y})"/>`;
}

/** A red rubber-stamp postmark: "A LETTER WAITING", the number of letters in its middle. */
function postmark(letters: number, print: string): string {
  if (letters <= 0) return '';
  const word = letters === 1 ? 'LETTER' : `${letters} LETTERS`;
  // Struck on the shell's right end, over the window's edge, clear of the handwriting.
  return `<g transform="rotate(-12 88 31)" opacity="0.9">
    <circle cx="88" cy="31" r="8.6" fill="#1C1C1E" fill-opacity="0.35" stroke="#E2483A" stroke-width="0.8"/>
    <circle cx="88" cy="31" r="7" fill="none" stroke="#E2483A" stroke-width="0.35"/>
    <text x="88" y="30" font-family="${print}" font-size="2.2" fill="#E2483A" text-anchor="middle" letter-spacing="0.1">${esc(word)}</text>
    <text x="88" y="33.8" font-family="${print}" font-size="2.2" fill="#E2483A" text-anchor="middle" letter-spacing="0.1">WAITING</text>
  </g>`;
}

/** The whole cassette as an SVG string, drawn edge to edge in its 100 × 63 box. */
export function cassetteSvg(o: CassetteSvgOptions): string {
  const c = o.style ?? cassetteStyle('black');
  const stripe = c.stripes[c.stripes.length > 1 ? 2 : 0] ?? c.accent;
  const band = c.stripes.length > 1
    ? c.stripes.map((h, i) => `<rect x="6" y="${(44 + (i * 7) / c.stripes.length).toFixed(2)}" width="88" height="${(7 / c.stripes.length + 0.05).toFixed(2)}" fill="${h}"/>`).join('')
    : `<rect x="6" y="44" width="88" height="7" rx="0.8" fill="${c.clear ? '#F2F2F2' : '#E9DFC4'}" fill-opacity="${c.clear ? 0.25 : 1}"/><rect x="46" y="44" width="12" height="7" fill="${c.accent}" fill-opacity="0.85"/>`;
  const bandInk = c.clear ? '#F2F2F2' : c.stripes.length > 1 ? '#FFF6E2' : '#2A2118';
  const played = Math.max(0, Math.min(1, o.played));
  const left = 9 + 8 * (1 - played);
  const right = 9 + 8 * played;
  const shards = o.state === 'Gone';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.shell[0]}"/><stop offset="0.3" stop-color="${c.shell[1]}"/><stop offset="1" stop-color="${c.shell[2]}"/></linearGradient>
    <radialGradient id="tape"><stop offset="0.4" stop-color="${c.tape}"/><stop offset="1" stop-color="#0A0705"/></radialGradient>
    <linearGradient id="glint" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.4" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.label}"/><stop offset="1" stop-color="${c.label}" stop-opacity="0.9"/></linearGradient>
    <radialGradient id="screw" cx="0.35" cy="0.35"><stop offset="0" stop-color="#C4C4C8"/><stop offset="0.6" stop-color="#8C8C90"/><stop offset="1" stop-color="#55555A"/></radialGradient>
    <clipPath id="shell"><rect x="0" y="0" width="${W}" height="${H}" rx="3"/></clipPath>
    <clipPath id="win"><rect x="14" y="21.5" width="72" height="19.5" rx="2.2"/></clipPath>
  </defs>
  <g ${shards ? 'opacity="0.92"' : ''}>
  <rect x="0" y="0" width="${W}" height="${H}" rx="3" fill="url(#body)"/>
  <rect x="0.3" y="0.3" width="99.4" height="62.4" rx="2.8" fill="none" stroke="${c.edge}" stroke-width="0.6"/>
  <g clip-path="url(#win)">
    <rect x="14" y="21.5" width="72" height="19.5" fill="${c.window}"/>
    ${reel(29, left)}${reel(71, right)}
    <rect x="14" y="38.6" width="72" height="0.9" fill="${c.tape}"/>
    <rect x="14" y="21.5" width="72" height="19.5" fill="url(#glint)"/>
  </g>
  <rect x="14" y="21.5" width="72" height="19.5" rx="2.2" fill="none" stroke="#55555A" stroke-width="0.6"/>
  <rect x="6" y="17.6" width="88" height="1.6" fill="${stripe}"/>
  <rect x="6" y="4" width="88" height="13.6" rx="1.2" fill="url(#paper)"/>
  <rect x="8" y="5.6" width="6" height="6" fill="${c.side}"/>
  <text x="11" y="10.3" font-family="${o.print}" font-size="5" fill="${c.label}" text-anchor="middle">A</text>
  <text x="16.5" y="10.4" font-family="${o.hand}" font-size="5.6" fill="${c.ink}">${esc(o.title)}</text>
  <rect x="16.5" y="11.4" width="74" height="0.3" fill="#9A9A9A"/>
  <text x="16.5" y="15.8" font-family="${o.hand}" font-size="4.2" fill="${c.ink}" fill-opacity="0.85">${esc(o.line)}</text>
  ${band}
  <text x="8" y="49.2" font-family="${o.print}" font-size="3.6" fill="${bandInk}" letter-spacing="0.4">LOOKBACK</text>
  <text x="92" y="49.2" font-family="${o.print}" font-size="3.6" fill="${bandInk}" text-anchor="end">${esc(o.detail)}</text>
  <path d="M20 63 L22 54 L78 54 L80 63 Z" fill="${c.foot}" stroke="${c.edge}" stroke-width="0.4"/>
  <circle cx="30" cy="58.5" r="1.75" fill="#050505"/><circle cx="43" cy="58.5" r="1.25" fill="#050505"/><circle cx="57" cy="58.5" r="1.25" fill="#050505"/><circle cx="70" cy="58.5" r="1.75" fill="#050505"/>
  ${screw(3.3, 3.3)}${screw(96.7, 3.3)}${screw(3.3, 59.7)}${screw(96.7, 59.7)}${screw(50, 51.3)}
  ${crackLayer(o.state)}
  </g>
  ${postmark(o.letters, o.print)}
</svg>`;
}
