/**
 * The Shared page is arranged by person: each of your people (and anyone who gave you a page before you added them)
 * once, with everything they gave you behind them. Pure, so it is tested in __tests__/sharedPeople.test.ts.
 */

export interface PersonLike {
  id: string;
  name: string;
  addedAt: string;
  portrait: string | null;
}

export interface LetterLike {
  id: string;
  senderId: string;
  senderName: string;
  senderPortrait: string | null;
  receivedAt: string;
  openedAt: string | null;
}

export interface SharedPerson<P extends PersonLike, L extends LetterLike> {
  id: string;
  name: string;
  portrait: string | null;
  /** In your people (null: they gave you a page, but aren't added). */
  person: P | null;
  /** What they gave you, newest first. */
  letters: L[];
  unread: number;
  /** When the last page from them arrived (ISO), or null. */
  lastAt: string | null;
}

/**
 * One entry per person: unread first, then whoever gave you something most recently, then people who haven't given
 * you anything yet (newest added first). A page's own name and portrait stand in for someone not in your people.
 */
export function groupByPerson<P extends PersonLike, L extends LetterLike>(people: readonly P[], letters: readonly L[]): SharedPerson<P, L>[] {
  const byId = new Map<string, SharedPerson<P, L>>();
  for (const p of people) byId.set(p.id, { id: p.id, name: p.name, portrait: p.portrait, person: p, letters: [], unread: 0, lastAt: null });
  for (const l of letters) {
    let g = byId.get(l.senderId);
    if (!g) {
      g = { id: l.senderId, name: l.senderName, portrait: l.senderPortrait, person: null, letters: [], unread: 0, lastAt: null };
      byId.set(l.senderId, g);
    }
    g.letters.push(l);
  }
  for (const g of byId.values()) {
    g.letters.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : 0));
    g.unread = g.letters.filter((l) => !l.openedAt).length;
    g.lastAt = g.letters[0]?.receivedAt ?? null;
    if (!g.portrait) g.portrait = g.letters.find((l) => l.senderPortrait)?.senderPortrait ?? null;
  }
  return [...byId.values()].sort((a, b) => {
    if (!!a.unread !== !!b.unread) return a.unread ? -1 : 1;
    if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0;
    if (a.lastAt || b.lastAt) return a.lastAt ? -1 : 1;
    const aa = a.person?.addedAt ?? '';
    const ba = b.person?.addedAt ?? '';
    return aa < ba ? 1 : aa > ba ? -1 : 0;
  });
}
