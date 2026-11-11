import { addDays, type LocalDate } from './dates';

/**
 * The app icon is the bunny, and it reacts to whether today's page has been written, the way a pet
 * that misses you would. Pure, so it is tested in __tests__/appIcon.test.ts.
 *
 *   Default  waving (today is written, or it's still early and yesterday was written, or nothing yet)
 *   Waiting  big pleading eyes, paws clasped (evening, and today is still empty)
 *   Missed   crying (a whole day was missed)
 *   Gone     wailing in a puddle (three days or more without a page)
 *
 * The names match the alternate icons in app.json (`expo-alternate-app-icons`).
 */
export type IconState = 'Default' | 'Waiting' | 'Missed' | 'Gone';

/** From this hour, an empty page makes the bunny start pleading. */
export const WAITING_FROM_HOUR = 18;
/** Days since the last page from which the bunny wails instead of crying. */
export const GONE_AFTER_DAYS = 4;

export function iconStateFor(entryDates: readonly LocalDate[], today: LocalDate, hour: number): IconState {
  if (entryDates.length === 0) return 'Default'; // never nag someone who hasn't started
  if (entryDates.includes(today)) return 'Default';
  const past = entryDates.filter((d) => d < today);
  if (past.length === 0) return hour >= WAITING_FROM_HOUR ? 'Waiting' : 'Default';
  const last = past.reduce((a, b) => (a > b ? a : b));
  if (last === addDays(today, -1)) return hour >= WAITING_FROM_HOUR ? 'Waiting' : 'Default';
  let gap = 2;
  while (gap < GONE_AFTER_DAYS && addDays(today, -gap) !== last) gap += 1;
  return gap >= GONE_AFTER_DAYS ? 'Gone' : 'Missed';
}
