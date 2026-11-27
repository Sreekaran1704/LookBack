/**
 * "What's new": the few things worth telling someone after an update, shown once as a little deck of cards. Pure (no
 * React Native imports), tested in __tests__/whatsNew.test.ts. Add a release at the top of RELEASES; its cards are
 * drawn by components/WhatsNewSheet.tsx, keyed by `picture`.
 */

/** Which drawing a card shows (WhatsNewSheet draws each live from the app's own pieces). */
export type WhatsNewPicture = 'cassettes' | 'recording' | 'mailbox' | 'people' | 'widgets' | 'portrait';

export interface WhatsNewCard {
  picture: WhatsNewPicture;
  title: string;
  body: string;
}

export interface WhatsNewRelease {
  version: string;
  cards: WhatsNewCard[];
}

/** Newest first. */
export const RELEASES: WhatsNewRelease[] = [
  {
    version: '1.3.3',
    cards: [
      { picture: 'people', title: 'Friends, and a chat', body: 'Add each other to be friends. Once a page has passed between you, chat, send voice notes, react ❤️, and quote lines into your page.' },
      { picture: 'mailbox', title: 'Kept in your own Drive', body: 'Pages you give and get back up to your own Google Drive. A sealed page waits on our server a week at most, and only until they have it.' },
      { picture: 'portrait', title: 'A portrait that reacts', body: 'Making your portrait is shorter now, in four tabs. Scroll down and the little you hops out to watch, pulling a face at each change.' },
    ],
  },
  {
    version: '1.3.2',
    cards: [
      { picture: 'cassettes', title: 'Pick your cassette', body: 'Six tapes to choose from in You → Look. Yours becomes the app icon and every tape in your diary.' },
      { picture: 'recording', title: 'Recording, on tape', body: 'Your voice now records like a real deck: reels turning, the REC lamp on, your waveform underneath.' },
      { picture: 'mailbox', title: 'Pages that find them anywhere', body: "Give a page to someone far away, even when their phone is off. It waits sealed for them, and only their phone can open it." },
      { picture: 'people', title: 'Shared, person by person', body: 'Everything someone gave you now sits together. Tap a person to read all their pages.' },
      { picture: 'widgets', title: 'Two new widgets', body: "Today shows what you kept (a photo, your words or a tape), and From your person shows the latest page from someone you love." },
    ],
  },
];

/** "1.10.0" > "1.9.2": compares version strings part by part. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The cards to show now. `seen` is the last version whose news was shown (null: never). Someone who hasn't finished the
 * first-run questions has just installed: everything is new to them, so nothing is shown (and `seen` moves on). Someone
 * who used the app before this existed (seen null, onboarded) gets the current release's cards.
 */
export function whatsNewToShow(o: { seen: string | null; current: string; onboarded: boolean; releases?: WhatsNewRelease[] }): WhatsNewCard[] {
  const releases = o.releases ?? RELEASES;
  if (!o.onboarded) return [];
  const due = releases.filter((r) => compareVersions(r.version, o.current) <= 0 && (o.seen === null ? compareVersions(r.version, o.current) === 0 : compareVersions(r.version, o.seen) > 0));
  // Several releases missed: newest first, at most six cards so it stays a glance.
  return due.flatMap((r) => r.cards).slice(0, 6);
}
