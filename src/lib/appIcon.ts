import { addDays, type LocalDate } from './dates';

/**
 * The app icon is a 90s cassette with a character: it falls apart the longer today's page goes unwritten, so it is
 * noticed. Pure, so it is tested in __tests__/appIcon.test.ts.
 *
 *   Default  pristine (today is written, or it's still early and yesterday was written, or nothing yet)
 *   Waiting  a little tape slipping out, "today?" on the label (evening, and today is still empty)
 *   Missed   the shell cracked, a loop of tape hanging out (a whole day was missed)
 *   Gone     broken apart, its tape unspooled and wound round the whole icon (four days or more without a page)
 *
 * The names match the alternate icons in app.json (`expo-alternate-app-icons`).
 */
export type IconState = 'Default' | 'Waiting' | 'Missed' | 'Gone';

/** From this hour, an empty page makes the tape start slipping out. */
export const WAITING_FROM_HOUR = 18;
/** Days since the last page from which the cassette is broken apart. */
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
