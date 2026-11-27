/**
 * What two friends see of their pages after one or both of them removed the other and added them again. Pure (no
 * React Native imports), tested in __tests__/friendship.test.ts.
 *
 * Each phone remembers when it last removed the other person (`mine`) and hears, with every hello, when the other
 * last removed it (`theirs`). If both have removed each other at some point, they started over: the pages from
 * before the later removal are deleted on both phones (what they gave you, and your list of what you gave them;
 * your own diary is never touched). If only one of them did (or neither), everything shows on both.
 */

/** Pages before this time are hidden (null: show everything). */
export function historySince(mine: string | null | undefined, theirs: string | null | undefined): string | null {
  if (!mine || !theirs) return null;
  return mine > theirs ? mine : theirs;
}

/** Whether a page passed at `at` is part of the history the two of you still share. */
export function inHistory(at: string, since: string | null): boolean {
  return since === null || at >= since;
}

/** A page this phone got from them, told back so their phone can list what it gave (`gift` id, page `date`, `at`). */
export interface GotPage {
  gift: string;
  date: string;
  at: string;
}
/** At most this many pages in one hello (a note is at most 24 KB). */
export const GOT_MAX = 120;

const ID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the `got` list in a hello; anything malformed is dropped. */
export function parseGot(raw: unknown): GotPage[] {
  if (!Array.isArray(raw)) return [];
  const out: GotPage[] = [];
  for (const item of raw.slice(0, GOT_MAX) as unknown[]) {
    const g = item as { g?: unknown; d?: unknown; a?: unknown } | null;
    if (!g || typeof g.g !== 'string' || !ID.test(g.g) || typeof g.d !== 'string' || !DATE.test(g.d) || typeof g.a !== 'string') continue;
    out.push({ gift: g.g.toLowerCase(), date: g.d, at: g.a });
  }
  return out;
}

/** The `got` list to send: the newest pages still in the shared history, in the short wire form. */
export function packGot(pages: readonly GotPage[], since: string | null): { g: string; d: string; a: string }[] {
  return [...pages]
    .filter((p) => inHistory(p.at, since))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, GOT_MAX)
    .map((p) => ({ g: p.gift, d: p.date, a: p.at }));
}
