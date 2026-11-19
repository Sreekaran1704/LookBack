/**
 * Where a photo memory's words go: on the polaroid's bottom strip when they fit, or on its back with a
 * "P.T.O" on the front. Pure (no React Native), so it is the same at every size and is unit-tested.
 *
 * The strip's handwriting is sized from the polaroid's width (a fixed number of letters per line), so
 * the same memory fits or doesn't fit whether it is drawn as a small pile thumbnail or full page.
 */

/** Letters per line on the strip, and how many lines it holds. */
export const POLAROID_CHARS_PER_LINE = 20;
export const POLAROID_FRONT_LINES = 2;
/** What the front ends with when the words are on the back. */
export const PTO = 'P.T.O';

export interface PolaroidWords {
  /** Words written on the front strip (all of them), or null. */
  front: string | null;
  /** Words written on the back, or null when there is no back. */
  back: string | null;
  /** When the words are on the back: the start of them, shortened to leave room for "… P.T.O". */
  teaser: string | null;
}

/** Lines the text takes when wrapped word by word at `perLine` letters (a long word is broken across lines). */
export function wrappedLines(text: string, perLine: number): number {
  let total = 0;
  for (const paragraph of text.split('\n')) {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let w = word.length;
      const need = used === 0 ? w : used + 1 + w;
      if (need <= perLine) {
        used = need;
        continue;
      }
      if (used > 0) {
        lines += 1;
        used = 0;
      }
      // A word longer than a line runs onto the next ones.
      while (w > perLine) {
        lines += 1;
        w -= perLine;
      }
      used = w;
    }
    total += lines;
  }
  return total;
}

/** The start of the text, cut at a word and short enough to sit before "… P.T.O" on the strip. */
function teaserOf(text: string, room: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= room) return flat;
  const cut = flat.slice(0, room);
  const space = cut.lastIndexOf(' ');
  return (space > room * 0.5 ? cut.slice(0, space) : cut).trim();
}

/**
 * `voice`: the polaroid has a voice note, whose waveform takes the strip, so any words go on the back
 * (the front then just says "P.T.O").
 */
export function planPolaroidWords(text: string, perLine = POLAROID_CHARS_PER_LINE, frontLines = POLAROID_FRONT_LINES, voice = false): PolaroidWords {
  const words = text.trim();
  if (!words) return { front: null, back: null, teaser: null };
  if (voice) return { front: null, back: words, teaser: null };
  if (wrappedLines(words, perLine) <= frontLines) return { front: words, back: null, teaser: null };
  // Room on the strip for the teaser: all its letters, less "… P.T.O" and a little slack for wrapping.
  const room = perLine * frontLines - (PTO.length + 4) - 4;
  return { front: null, back: words, teaser: teaserOf(words, room) };
}
