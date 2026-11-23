import { memo, useId, type ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { coversHair, filmTone, PORTRAIT_OPTIONS, type Portrait } from '../../lib/portrait';
import { mixHex } from '../../theme';

/**
 * Someone's portrait, as one frame cut from a strip of 35mm film: sprocket holes along both edges, the dark film base,
 * orange edge printing, and the picture inside with a soft vignette. The portrait is drawn from its parts (face shape,
 * build, eyes, brows, nose, mouth, hair, facial hair, head covering, top, accessory); the film stock tones every colour.
 * Drawing constants live here (a scrapbook piece); the choices are in `lib/portrait.ts`.
 */

/** Colours for the parts whose options are colours, in `PORTRAIT_OPTIONS` order. */
export const SKIN = ['#F7E1CF', '#F1D0B5', '#EBC3A0', '#E0B48C', '#D6A27A', '#C68E66', '#B07A52', '#9A6844', '#835536', '#6C442A', '#563420', '#3F2618'];
export const HAIR = ['#1E1712', '#3A2618', '#5A3A22', '#7A4E2A', '#A87444', '#D2A564', '#E3C88A', '#9A3A26', '#8E8A84', '#E4E0D8', '#D88AA6', '#5E7FB0'];
export const EYES = ['#3B2A1E', '#5A3A22', '#7A6A3A', '#4E6A4A', '#4A6A8A', '#6A7078'];
export const TOPS = ['#5A2A2E', '#2E4A3A', '#26365A', '#4A3352', '#5B4024', '#3A3A3A'];
/** The swatch colour shown in the maker for a colour part. */
export const PORTRAIT_SWATCHES: Partial<Record<keyof Portrait, readonly string[]>> = { skin: SKIN, hairColor: HAIR, eyeColor: EYES, topColor: TOPS };

const INK = '#2A2118';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const EYE_WHITE = '#FBF6EE';
const GOLD = '#C9A45C';
const PEARL = '#F6F0E2';
const PEARL_EDGE = '#B9A98A';
const SHIRT = '#F1E8D6';
const BLUSH = '#D88A7A';
const LIPS = '#7A2E2E';
const MOUTH_IN = '#6A2A2A';
const BINDI = '#A8302E';
const BERET = '#7A2230';
const FLAT_CAP = '#6B5A44';
const PETAL = '#E0A0A8';
const FLOWER_EYE = '#E9C46A';
const BOW = '#A8402E';
const BOW_KNOT = '#7A2230';
/** The film: its base, the holes (the card shows through), the edge printing. */
const FILM_BASE = '#1E1A16';
const EDGE_PRINT = '#D9963C';
const PICTURE_BG = ['#E6D2AE', '#DAD7D0', '#E7C7A0', '#2E2A3A'];
const FRAME_W = 64;
const FRAME_H = 78;

const FACE: Record<string, string> = {
  oval: 'M32 14 C42 14 45.5 21 45.5 29 C45.5 38 40 45 32 45 C24 45 18.5 38 18.5 29 C18.5 21 22 14 32 14Z',
  round: 'M32 14.5 C42 14.5 46.2 21 46.2 30 C46.2 39 40 44.5 32 44.5 C24 44.5 17.8 39 17.8 30 C17.8 21 22 14.5 32 14.5Z',
  square: 'M32 14 C42 14 46 20 46 28 L46 35.5 C46 40.5 42 44.8 36.5 45.8 L27.5 45.8 C22 44.8 18 40.5 18 35.5 L18 28 C18 20 22 14 32 14Z',
  long: 'M32 12.5 C41.5 12.5 45 19.5 45 28 C45 39.5 40 47.5 32 47.5 C24 47.5 19 39.5 19 28 C19 19.5 22.5 12.5 32 12.5Z',
  heart: 'M32 14 C42.5 14 46 21 46 28 C46 36 38.5 44 32 45.5 C25.5 44 18 36 18 28 C18 21 21.5 14 32 14Z',
};

const pick = <K extends keyof typeof PORTRAIT_OPTIONS>(p: Portrait, k: K) => PORTRAIT_OPTIONS[k][p[k]] as (typeof PORTRAIT_OPTIONS)[K][number];

/** The picture itself, in a 64 × 64 box. */
function Art({ p }: { p: Portrait }) {
  const t = (hex: string) => filmTone(p.film, hex);
  const sk = SKIN[p.skin] ?? SKIN[5]!;
  const hc = HAIR[p.hairColor] ?? HAIR[0]!;
  const out = TOPS[p.topColor] ?? TOPS[0]!;
  const shade = t(mixHex(sk, BLACK, 0.2));
  const lip = t(mixHex(sk, LIPS, 0.42));
  const cov = t(mixHex(out, WHITE, 0.22));
  const covEdge = t(mixHex(out, BLACK, 0.06));
  const hcD = t(mixHex(hc, BLACK, 0.3));
  const hcL = t(mixHex(hc, WHITE, 0.22));
  const skT = t(sk);
  const hcT = t(hc);
  const outT = t(out);
  const outD = t(mixHex(out, BLACK, 0.25));
  const inkT = t(INK);
  const gold = t(GOLD);
  const hair = pick(p, 'hair');
  const cover = pick(p, 'cover');
  const hijab = cover === 'hijab';
  const showHair = !coversHair(p);
  const face = FACE[pick(p, 'face')] ?? FACE.oval!;
  const blobs = (pts: number[][], r: number) => pts.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={r} fill={hcT} />);
  const crown = (y1: number) => (
    <Path d={`M17.6 ${y1} C17 14 24 10 32 10 C40 10 47 14 46.4 ${y1} C43 19.5 38 17.5 32 18 C26 17.5 21 19.5 17.6 ${y1}Z`} fill={hcT} />
  );

  // ---- hair behind the head
  const back: Record<string, ReactNode> = {
    bob: <Path d="M15 24 C14 34 15 41 18 45 L46 45 C49 41 50 34 49 24Z" fill={hcT} />,
    waves: <Path d="M15 24 C13 36 14 46 16 52 Q20 50 22 53 Q26 50 30 53 L34 53 Q38 50 42 53 Q44 50 48 52 C50 46 51 36 49 24Z" fill={hcT} />,
    long: <Path d="M15 26 C13 44 14 55 17 62 L47 62 C50 55 51 44 49 26Z" fill={hcT} />,
    'long curly': blobs([[16, 30], [15, 38], [16, 46], [18, 54], [48, 30], [49, 38], [48, 46], [46, 54], [22, 58], [42, 58], [28, 60], [36, 60]], 5.5),
    ponytail: <Path d="M44 20 C56 22 56 42 50 52 C48 42 47 32 43 26Z" fill={hcT} />,
    bun: <Circle cx={32} cy={10} r={7} fill={hcT} />,
    'top knot': <Circle cx={32} cy={8} r={5} fill={hcT} />,
    mullet: <Path d="M18 30 C17 40 18 47 21 51 L43 51 C46 47 47 40 46 30Z" fill={hcT} />,
    afro: <Circle cx={32} cy={24} r={21} fill={hcT} />,
    coils: blobs([[18, 16], [25, 10], [32, 8], [39, 10], [46, 16], [15, 24], [49, 24], [16, 32], [48, 32]], 6.5),
    'twist-out': blobs([[17, 14], [23, 8], [30, 5], [37, 6], [44, 10], [49, 17], [13, 22], [51, 24], [13, 31], [51, 32], [15, 39], [49, 39]], 6.2),
    locs: [16, 20, 24, 40, 44, 48].map((x) => <Rect key={x} x={x - 2.2} y={22} width={4.4} height={36 + (x % 3) * 3} rx={2.2} fill={hcT} />),
    'box braids': [15, 18.5, 22, 42, 45.5, 49].map((x) => (
      <G key={x}>
        <Rect x={x - 1.6} y={20} width={3.2} height={40 + (x % 2) * 2} rx={1.6} fill={hcT} />
        <Path d={`M${x - 1.6} 30 h3.2 M${x - 1.6} 40 h3.2 M${x - 1.6} 50 h3.2`} stroke={hcD} strokeWidth={0.5} />
      </G>
    )),
  };

  // ---- hair over the head
  const front: Record<string, ReactNode> = {
    bald: <Ellipse cx={27} cy={19} rx={4} ry={2} fill={WHITE} opacity={0.16} />,
    buzz: <Path d="M18.4 26 C18.4 15 25 12 32 12 C39 12 45.6 15 45.6 26 C42 19.5 37 18.5 32 18.5 C27 18.5 22 19.5 18.4 26Z" fill={hcT} opacity={0.78} />,
    crop: crown(27),
    'side part': (
      <G>
        {crown(27)}
        <Path d="M26 10.8 L27.5 17.5" stroke={hcL} strokeWidth={0.8} />
      </G>
    ),
    quiff: (
      <G>
        {crown(27)}
        <Path d="M24 11 C30 2 42 4 44 13 C38 9.5 31 9.5 24 11Z" fill={hcT} />
      </G>
    ),
    fade: (
      <G>
        <Path d="M18.2 28 C18 20 21 15 25 13 C28 9 38 8 42 12 C45 14 46 20 45.8 28 L44.5 24 C44 21 42 19.5 39 19 L25 19 C22 19.5 20 21 19.5 24Z" fill={hcT} />
        <Path d="M18.2 28 L19.5 24 M45.8 28 L44.5 24" stroke={hcT} strokeWidth={1.5} opacity={0.45} />
      </G>
    ),
    mullet: crown(27),
    bob: <Path d="M17 31 C15 15 25 9 32 9 C40 9 49 15 47 31 C44 22 39 17 32 17 C25 17 20 22 17 31Z" fill={hcT} />,
    waves: <Path d="M17 30 C15 15 25 9 32 9 C40 9 49 15 47 30 C44 22 39 16 30 17 C25 18 20 23 17 30Z" fill={hcT} />,
    long: <Path d="M17 31 C15 15 25 9 32 9 C40 9 49 15 47 31 C43 21 37 16 32 16 C27 16 21 21 17 31Z" fill={hcT} />,
    'long curly': blobs([[19, 18], [25, 12], [32, 10], [39, 12], [45, 18], [17, 25], [47, 25]], 5.4),
    ponytail: crown(26),
    bun: crown(26),
    'top knot': crown(25),
    afro: <Path d="M17 24 C20 18 26 16 32 17 C38 16 44 18 47 24 C44 19 38 18 32 19 C26 18 20 19 17 24Z" fill={hcT} />,
    coils: blobs([[22, 16], [28, 13], [36, 13], [42, 16]], 4.5),
    'twist-out': blobs([[21, 16], [27, 12], [33, 11], [39, 12], [44, 16]], 4.6),
    locs: (
      <G>
        {crown(26)}
        {[22, 27, 32, 37, 42].map((x) => (
          <Rect key={x} x={x - 2} y={12} width={4} height={10} rx={2} fill={hcT} stroke={hcD} strokeWidth={0.4} />
        ))}
      </G>
    ),
    'box braids': (
      <G>
        {crown(25)}
        <Path d="M24 13 L22 22 M32 11 L32 18 M40 13 L42 22" stroke={hcL} strokeWidth={0.6} />
      </G>
    ),
    cornrows: (
      <G>
        {crown(25)}
        {[24, 28, 32, 36, 40].map((x) => (
          <Path key={x} d={`M${x} 11.5 Q${x + (x - 32) * 0.25} 17 ${x + (x - 32) * 0.4} 22`} stroke={hcL} strokeWidth={0.6} fill="none" />
        ))}
      </G>
    ),
  };

  // ---- eyes and brows
  const eyeKind = pick(p, 'eyes');
  const lashes = pick(p, 'lashes') === 'lashes';
  const ry = { round: 2.5, almond: 1.9, monolid: 1.5, hooded: 2.1 }[eyeKind];
  const iris = t(EYES[p.eyeColor] ?? EYES[0]!);
  const eye = (x: number) => (
    <G key={x}>
      <Ellipse cx={x} cy={30.2} rx={3.1} ry={ry} fill={t(EYE_WHITE)} />
      <Circle cx={x} cy={30.3} r={Math.min(1.8, ry)} fill={iris} />
      <Circle cx={x} cy={30.3} r={0.8} fill={inkT} />
      <Circle cx={x + 0.7} cy={29.6} r={0.5} fill={WHITE} />
      {eyeKind === 'hooded' ? (
        <Path d={`M${x - 3.4} ${30.8 - ry} Q${x} ${29.1 - ry} ${x + 3.4} ${30.8 - ry} L${x + 3.4} ${31.6 - ry} Q${x} ${30.2 - ry} ${x - 3.4} ${31.6 - ry}Z`} fill={shade} />
      ) : null}
      <Path d={`M${x - 3.2} 30.2 Q${x} ${30.2 - ry * 1.55} ${x + 3.2} 30.2`} stroke={inkT} strokeWidth={lashes ? 1.1 : 0.7} fill="none" />
      {eyeKind === 'monolid' ? null : <Path d={`M${x - 2.6} ${29.3 - ry} Q${x} ${28.2 - ry} ${x + 2.6} ${29.3 - ry}`} stroke={shade} strokeWidth={0.45} fill="none" />}
      {lashes ? <Path d={`M${x + 2.6} ${30.2 - ry * 0.9} l1.3 -0.9 M${x + 1.6} ${30.2 - ry * 1.25} l0.9 -1.1`} stroke={inkT} strokeWidth={0.55} /> : null}
    </G>
  );
  const [bw, ba] = ({ thin: [0.9, 1.4], straight: [1.6, 0.2], arched: [1.4, 2.2], thick: [2.4, 1] } as const)[pick(p, 'brows')];
  const browColor = t(mixHex(hc, INK, 0.25));
  const brow = (x: number, dir: number) => (
    <Path key={`b${x}`} d={`M${x - 3.4} 26.2 Q${x} ${26.2 - ba} ${x + 3.4} ${26.2 + dir * 0.3}`} stroke={browColor} strokeWidth={bw} fill="none" strokeLinecap="round" />
  );

  // ---- nose and mouth
  const nose = {
    small: <Path d="M32.6 31.5 q0.8 2.6 -1.2 3.2" stroke={shade} strokeWidth={0.8} fill="none" strokeLinecap="round" />,
    button: (
      <G>
        <Path d="M30.3 34.2 q1.7 1.4 3.4 0" stroke={shade} strokeWidth={0.8} fill="none" strokeLinecap="round" />
        <Ellipse cx={32} cy={33.2} rx={1.6} ry={1.1} fill={shade} opacity={0.25} />
      </G>
    ),
    broad: (
      <G>
        <Path d="M31 30.5 L30.4 33 M29 34 q1 1.2 3 0.8 q2 0.4 3 -0.8" stroke={shade} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        <Circle cx={29.6} cy={34.2} r={0.5} fill={shade} />
        <Circle cx={34.4} cy={34.2} r={0.5} fill={shade} />
      </G>
    ),
    long: <Path d="M31.4 27.5 L31 33.6 M30 34.6 q2 1 4 0" stroke={shade} strokeWidth={0.8} fill="none" strokeLinecap="round" />,
  }[pick(p, 'nose')];
  const beard = pick(p, 'beard');
  const bearded = beard === 'short beard' || beard === 'full beard';
  const mouthKind = pick(p, 'mouth');
  const mouth =
    bearded && mouthKind !== 'grin' ? (
      <Path d="M29.4 40 q2.6 1.3 5.2 0" stroke={lip} strokeWidth={1.1} fill="none" />
    ) : (
      {
        smile: <Path d="M28.6 38.6 Q32 41.4 35.4 38.6" stroke={lip} strokeWidth={1.2} fill="none" strokeLinecap="round" />,
        grin: (
          <G>
            <Path d="M28.2 38.2 Q32 38.9 35.8 38.2 Q35 42.4 32 42.4 Q29 42.4 28.2 38.2Z" fill={t(MOUTH_IN)} />
            <Path d="M28.8 38.5 Q32 39.2 35.2 38.5 L34.8 39.8 Q32 40.3 29.2 39.8Z" fill={t(EYE_WHITE)} />
          </G>
        ),
        neutral: <Path d="M29.4 39.4 L34.6 39.4" stroke={lip} strokeWidth={1.2} strokeLinecap="round" />,
        smirk: <Path d="M29 39.6 Q32 40.2 35.4 38.4" stroke={lip} strokeWidth={1.2} fill="none" strokeLinecap="round" />,
      }[mouthKind]
    );
  const facialHair = {
    none: null,
    stubble: (
      <G>
        <Path d="M19 33 C19 43 25 46.5 32 46.5 C39 46.5 45 43 45 33 C43 40 38 42.5 32 42.5 C26 42.5 21 40 19 33Z" fill={hcT} opacity={0.24} />
        <Path d="M28 37 Q32 36 36 37" stroke={hcT} strokeWidth={1.6} opacity={0.2} />
      </G>
    ),
    moustache: <Path d="M27.4 37.4 C29 35.6 31 36.2 32 37 C33 36.2 35 35.6 36.6 37.4 C34.6 38.2 33 38 32 37.6 C31 38 29.4 38.2 27.4 37.4Z" fill={hcT} />,
    goatee: <Path d="M27.8 37.4 C30 36 31 36.4 32 37 C33 36.4 34 36 36.2 37.4 C34 38 30 38 27.8 37.4Z M29.3 41.4 C29.8 45.4 34.2 45.4 34.7 41.4 C33 42.4 31 42.4 29.3 41.4Z" fill={hcT} />,
    'short beard': (
      <G>
        <Path d="M18.6 31 C18.6 43 24.5 47.5 32 47.5 C39.5 47.5 45.4 43 45.4 31 C44 38 41 41 37 40.4 C35 38.6 33 39 32 39.3 C31 39 29 38.6 27 40.4 C23 41 20 38 18.6 31Z" fill={hcT} opacity={0.85} />
        <Path d="M27.6 37.3 C29 36 31 36.4 32 37 C33 36.4 35 36 36.4 37.3 C34.6 38 29.4 38 27.6 37.3Z" fill={hcT} />
      </G>
    ),
    'full beard': (
      <G>
        <Path d="M18.2 29 C18 45 24 50.5 32 50.5 C40 50.5 46 45 45.8 29 C44.5 37 41.5 40.5 37 40 C35 38.4 33 38.8 32 39.2 C31 38.8 29 38.4 27 40 C22.5 40.5 19.5 37 18.2 29Z" fill={hcT} />
        <Path d="M27.4 37.3 C29 35.8 31 36.3 32 37 C33 36.3 35 35.8 36.6 37.3 C34.6 38.2 29.4 38.2 27.4 37.3Z" fill={hcD} />
      </G>
    ),
  }[beard];

  // ---- head coverings
  const coverArt = {
    none: null,
    hijab: (
      <G>
        <Path d="M11 64 C11 52 14 44 17.5 40 C13 30 15 11 32 10 C49 11 51 30 46.5 40 C50 44 53 52 53 64Z" fill={cov} />
        <Path d="M19 31 C19 18 24 14.5 32 14.5 C40 14.5 45 18 45 31" fill="none" stroke={covEdge} strokeWidth={0.8} />
      </G>
    ),
    turban: (
      <G>
        <Path d="M17 25 C14 12 24 5 32 5 C40 5 50 12 47 25 C43 20 38 19 32 19.5 C26 19 21 20 17 25Z" fill={cov} />
        <Path d="M20 21 C24 12 36 9 45 16 M18 16 C26 9 38 10 44 21" stroke={covEdge} strokeWidth={0.9} fill="none" />
      </G>
    ),
    headwrap: (
      <G>
        <Path d="M17 24 C15 12 24 8 32 8 C40 8 49 12 47 24 C43 19 38 18 32 18.5 C26 18 21 19 17 24Z" fill={cov} />
        <Path d="M28 9 C24 2 30 0 32 6 C34 0 40 2 36 9Z" fill={cov} />
        <Path d="M20 18 C27 13 37 13 44 18" stroke={covEdge} strokeWidth={0.8} fill="none" />
      </G>
    ),
    kippah: <Path d="M24 13.5 C26 10 38 10 40 13.5 C36 12.5 28 12.5 24 13.5Z" fill={outT} />,
    beret: (
      <G>
        <Path d="M15 21 C16 9 40 6 49 15 C46 20 30 22 15 21Z" fill={t(BERET)} />
        <Circle cx={34} cy={8.5} r={1.6} fill={t(BERET)} />
      </G>
    ),
    'flat cap': <Path d="M17 21 C18 10 44 9 47 19 L53 21 C45 23 28 22 17 21Z" fill={t(FLAT_CAP)} />,
    beanie: (
      <G>
        <Path d="M17 22 C16 10 25 6 32 6 C39 6 48 10 47 22Z" fill={cov} />
        <Rect x={16} y={19} width={32} height={5} rx={2} fill={t(mixHex(out, BLACK, 0.12))} />
      </G>
    ),
    cap: (
      <G>
        <Path d="M17.5 21 C17 9 47 9 46.5 21Z" fill={cov} />
        <Path d="M17 21 C24 19 40 19 47 21 C46 24 18 24 17 21Z" fill={t(mixHex(out, BLACK, 0.2))} />
        <Circle cx={32} cy={10.4} r={1} fill={t(mixHex(out, BLACK, 0.2))} />
      </G>
    ),
  }[cover];

  // ---- accessories
  const accessory = {
    none: null,
    glasses: (
      <G>
        <Rect x={22.6} y={27.3} width={8.4} height={6} rx={1.6} fill="none" stroke={inkT} strokeWidth={1.2} />
        <Rect x={33} y={27.3} width={8.4} height={6} rx={1.6} fill="none" stroke={inkT} strokeWidth={1.2} />
        <Path d="M31 29.4 h2" stroke={inkT} strokeWidth={1} />
      </G>
    ),
    'round specs': (
      <G>
        <Circle cx={26.8} cy={30.2} r={4} fill="none" stroke={gold} strokeWidth={1} />
        <Circle cx={37.2} cy={30.2} r={4} fill="none" stroke={gold} strokeWidth={1} />
        <Path d="M30.8 30 h2.4" stroke={gold} />
      </G>
    ),
    pearls: (
      <G>
        {Array.from({ length: 9 }, (_, k) => {
          const f = k / 8;
          return <Circle key={k} cx={24 + f * 16} cy={50.5 + Math.sin(f * Math.PI) * 3.6} r={1.3} fill={t(PEARL)} stroke={t(PEARL_EDGE)} strokeWidth={0.4} />;
        })}
      </G>
    ),
    earrings: (
      <G>
        <Circle cx={18} cy={36.4} r={2} fill="none" stroke={gold} strokeWidth={0.9} />
        <Circle cx={46} cy={36.4} r={2} fill="none" stroke={gold} strokeWidth={0.9} />
      </G>
    ),
    stud: (
      <G>
        <Circle cx={17.6} cy={34.6} r={0.9} fill={gold} />
        <Circle cx={46.4} cy={34.6} r={0.9} fill={gold} />
      </G>
    ),
    'nose ring': <Circle cx={33.7} cy={34.6} r={1} fill="none" stroke={gold} strokeWidth={0.6} />,
    bindi: <Circle cx={32} cy={24.6} r={1} fill={t(BINDI)} />,
    flower: (
      <G x={43} y={17}>
        {[0, 72, 144, 216, 288].map((r) => (
          <Ellipse key={r} rx={2} ry={3.4} cy={-3} fill={t(PETAL)} rotation={r} />
        ))}
        <Circle r={1.6} fill={t(FLOWER_EYE)} />
      </G>
    ),
    bow: (
      <G>
        <Path d="M39 13 l-6 -4 v8z M39 13 l6 -4 v8z" fill={t(BOW)} />
        <Circle cx={39} cy={13} r={1.4} fill={t(BOW_KNOT)} />
      </G>
    ),
  }[pick(p, 'accessory')];

  // ---- body
  const build = pick(p, 'build');
  const [sl, sr] = ({ slim: [16, 48], medium: [13, 51], broad: [9, 55] } as const)[build];
  const nw = { slim: 7, medium: 8.5, broad: 10.5 }[build];
  const nl = 32 - nw / 2;
  const nr = 32 + nw / 2;
  const top = {
    tee: <Path d={`M${nl - 1} 47.6 Q32 53 ${nr + 1} 47.6`} fill={skT} stroke={outD} strokeWidth={0.8} />,
    hoodie: (
      <G>
        <Path d={`M${nl - 4} 47 Q32 55 ${nr + 4} 47 Q${nr + 2} 51 32 52 Q${nl - 2} 51 ${nl - 4} 47Z`} fill={outD} />
        <Path d="M30 51.5 v6 M34 51.5 v6" stroke={t(mixHex(out, WHITE, 0.5))} strokeWidth={0.7} />
      </G>
    ),
    shirt: (
      <G>
        <Path d={`M${nl} 47.6 L32 53.5 L${nr} 47.6Z`} fill={skT} />
        <Path d={`M${nl - 1} 47 L31.6 53.6 L27 55 Z M${nr + 1} 47 L32.4 53.6 L37 55Z`} fill={t(SHIRT)} />
      </G>
    ),
    blazer: (
      <G>
        <Path d={`M${nl} 47.6 L32 56 L${nr} 47.6Z`} fill={t(SHIRT)} />
        <Path d={`M${nl - 1.5} 47.4 L32 60 L25 64 L${sl + 3} 64Z M${nr + 1.5} 47.4 L32 60 L39 64 L${sr - 3} 64Z`} fill={outD} />
      </G>
    ),
  }[pick(p, 'top')];
  const body = (
    <G>
      <Path d={`M${sl} 64 C${sl + 1} 52 21 47.5 32 47.5 C43 47.5 ${sr - 1} 52 ${sr} 64Z`} fill={outT} />
      {top}
      <Rect x={nl} y={40} width={nw} height={9.5} fill={skT} />
      <Rect x={nl} y={40} width={nw} height={3.4} fill={shade} opacity={0.45} />
    </G>
  );
  const head = (
    <G>
      {hijab ? null : (
        <G>
          <Ellipse cx={17.6} cy={31} rx={2.3} ry={3.4} fill={skT} />
          <Ellipse cx={46.4} cy={31} rx={2.3} ry={3.4} fill={skT} />
          <Path d="M17 30 q1 1.2 0.2 2.6 M47 30 q-1 1.2 -0.2 2.6" stroke={shade} strokeWidth={0.5} fill="none" />
        </G>
      )}
      <Path d={face} fill={skT} />
      <Path d={face} fill="none" stroke={shade} strokeWidth={0.6} opacity={0.6} />
      {eye(26.8)}
      {eye(37.2)}
      {brow(26.8, 1)}
      {brow(37.2, -1)}
      {nose}
      {pick(p, 'blush') === 'blush' ? (
        <G>
          <Ellipse cx={23.5} cy={35} rx={2.5} ry={1.4} fill={t(BLUSH)} opacity={0.35} />
          <Ellipse cx={40.5} cy={35} rx={2.5} ry={1.4} fill={t(BLUSH)} opacity={0.35} />
        </G>
      ) : null}
      {mouth}
      {facialHair}
    </G>
  );

  if (hijab) {
    return (
      <G>
        {body}
        {coverArt}
        {head}
        {accessory}
      </G>
    );
  }
  return (
    <G>
      {showHair ? back[hair] : null}
      {body}
      {head}
      {showHair ? front[hair] : null}
      {coverArt}
      {accessory}
    </G>
  );
}

/**
 * The portrait in its film frame. `size` is its height; it is 64:78 wide. `hole` is the colour behind the sprocket
 * holes (the card or page it sits on). `frame` is the number printed on the film's edge.
 */
export const FilmPortrait = memo(function FilmPortrait({ portrait, size, hole, frame = '24A' }: { portrait: Portrait; size: number; hole: string; frame?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const holes = [];
  for (let k = 0; k < 6; k++) {
    const x = 6 + k * 10.4;
    holes.push(<Rect key={`t${k}`} x={x} y={2.4} width={5.2} height={4} rx={1} fill={hole} />, <Rect key={`b${k}`} x={x} y={FRAME_H - 6.4} width={5.2} height={4} rx={1} fill={hole} />);
  }
  const lamplight = PORTRAIT_OPTIONS.film[portrait.film] === 'Lamplight';
  return (
    <Svg width={(size * FRAME_W) / FRAME_H} height={size} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}>
      <Defs>
        <ClipPath id={`c${id}`}>
          <Rect x={4} y={13} width={56} height={52} rx={2.5} />
        </ClipPath>
        <RadialGradient id={`v${id}`} cx="50%" cy="45%" r="72%">
          <Stop offset="0.6" stopColor={BLACK} stopOpacity={0} />
          <Stop offset="1" stopColor={BLACK} stopOpacity={0.38} />
        </RadialGradient>
      </Defs>
      <Rect width={FRAME_W} height={FRAME_H} rx={2} fill={FILM_BASE} />
      {holes}
      {size >= 60 ? (
        <>
          <SvgText x={4} y={11.8} fontSize={3.4} fill={EDGE_PRINT} fontFamily="monospace">
            {frame}
          </SvgText>
          <SvgText x={FRAME_W - 4} y={11.8} fontSize={3.4} fill={EDGE_PRINT} fontFamily="monospace" textAnchor="end">
            LB 400
          </SvgText>
        </>
      ) : null}
      <G clipPath={`url(#c${id})`}>
        <Rect x={4} y={13} width={56} height={52} fill={PICTURE_BG[portrait.film] ?? PICTURE_BG[2]} />
        <G transform="translate(4 12.5) scale(0.875 0.82)">
          <Art p={portrait} />
        </G>
        {lamplight ? <Rect x={4} y={13} width={56} height={52} fill={GOLD} opacity={0.08} /> : null}
        <Rect x={4} y={13} width={56} height={52} fill={`url(#v${id})`} />
      </G>
    </Svg>
  );
});
