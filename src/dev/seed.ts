import { entriesRepository, type Entry } from '../data';
import { addDays, atLocalTime, shiftYears, toLocalDate, type LocalDate } from '../lib/dates';
import { hashString } from '../lib/seeded';
import { generateSeedPhoto } from './seedPhotos';

/**
 * DEV ONLY. Seeds fake entries so the "one year ago" logic and every scrapbook object type can be
 * tested today. All seeded ids start with SEED_PREFIX so they can be removed without touching real
 * entries (their generated photos are deleted with them).
 */
export const SEED_PREFIX = 'seed-';

const SHORT = [
  'Coffee on the balcony before anyone was awake.',
  'Finally fixed the squeaky door.',
  'Small steps still count.',
  'Long walk, no podcast. Just the wind.',
  'Tried the new noodle place. 9/10.',
  'First cold morning of the season.',
  'Rain all day. Baked bread.',
  'Sunset from the bridge was unreal.',
  'Today was ordinary, and that was nice.',
];

const QUOTES = [
  '"Be here now." — sticky note on my monitor',
  '"Done is better than perfect."',
  '"Go slow to go far." — Grandpa',
];

const LONG = [
  'Called Grandma and she told the story about the summer the river froze and everyone skated to school. She laughed the whole time, and I wrote down as much as I could so I would not forget how she tells it.',
  'Got lost on the way home and found a tiny bookshop wedged between a bakery and a bike repair place. The owner recommended a book about lighthouses, and I ended up reading half of it on the bench outside.',
  'Big day at work: the thing we have been building for months finally shipped. Celebrated with tacos and a very long nap. Next week I want to remember to thank everyone properly.',
];

interface SeedItem {
  localDate: LocalDate;
  text: string;
  photo: boolean;
}

function seedEntry(item: SeedItem, photoPath: string | null): Entry {
  const at = atLocalTime(item.localDate, 20).toISOString();
  return {
    id: `${SEED_PREFIX}${item.localDate}`,
    localDate: item.localDate,
    text: item.text,
    photoPath,
    createdAt: at,
    updatedAt: at,
    objectType: null,
    tapePattern: null,
    sticker: null,
    stickerColor: null,
    tapeColor: null,
  };
}

function textFor(i: number): string {
  if (i % 7 === 3) return LONG[i % LONG.length] ?? '';
  if (i % 5 === 1) return QUOTES[i % QUOTES.length] ?? '';
  return SHORT[i % SHORT.length] ?? '';
}

/** The entries we seed, relative to `today`. Exported for inspection. */
export function seedPlan(today: LocalDate): SeedItem[] {
  const out: SeedItem[] = [];
  // 1–4 years ago today: fills the "On this day" pile with a mix of objects.
  out.push({ localDate: shiftYears(today, -1), text: 'Picnic in the park with the whole crew.\nWe stayed until the lights came on.', photo: true });
  out.push({ localDate: shiftYears(today, -2), text: 'Moved into the new place. Boxes everywhere.', photo: false });
  out.push({ localDate: shiftYears(today, -3), text: '"Begin anywhere." — painted on the café wall', photo: false });
  out.push({ localDate: shiftYears(today, -4), text: 'Road trip, day one.', photo: true });
  // The next 10 days, one year back, so the notification window has something to schedule.
  for (let i = 1; i <= 10; i++) out.push({ localDate: shiftYears(addDays(today, i), -1), text: textFor(i), photo: i % 3 === 0 });
  // A spread across the last four years for the albums.
  for (let i = 0; i < 48; i++) {
    out.push({ localDate: addDays(shiftYears(today, -1), -(i * 27 + 5)), text: textFor(i + 2), photo: i % 4 === 0 });
  }
  // Leap day case: Feb 29, 2024 should surface on Feb 28 in 2025, 2026, 2027.
  out.push({ localDate: '2024-02-29', text: 'Leap day! An extra day, spent on pancakes.', photo: false });
  out.push({ localDate: '2025-02-28', text: 'Regular Feb 28, should show next to the leap day entry.', photo: false });
  return out;
}

/** Inserts seed entries, skipping any day that already has a real entry. Returns how many were added. */
export async function seedSampleEntries(today: LocalDate = toLocalDate()): Promise<number> {
  let added = 0;
  const seen = new Set<string>();
  for (const item of seedPlan(today)) {
    if (seen.has(item.localDate) || item.localDate >= today) continue;
    seen.add(item.localDate);
    const existing = await entriesRepository.getByDate(item.localDate);
    if (existing && !existing.id.startsWith(SEED_PREFIX)) continue;
    const photoPath = item.photo ? generateSeedPhoto(`${SEED_PREFIX}${item.localDate}.jpg`, hashString(item.localDate)) : null;
    await entriesRepository.insertRaw(seedEntry(item, photoPath));
    added++;
  }
  return added;
}

export async function clearSampleEntries(): Promise<number> {
  const all = await entriesRepository.getAll();
  const seeded = all.filter((e) => e.id.startsWith(SEED_PREFIX));
  for (const e of seeded) await entriesRepository.remove(e.id);
  return seeded.length;
}
