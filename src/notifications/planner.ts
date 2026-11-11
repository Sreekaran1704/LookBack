import {
  addDays,
  atLocalTime,
  onThisDay,
  parseLocalDate,
  yearsAgoLabel,
  yearsBetween,
  type LocalDate,
} from '../lib/dates';

/** iOS caps pending local notifications at 64; 30 leaves plenty of headroom. */
export const REMINDER_WINDOW_DAYS = 30;
export const MAX_FIRST_LINE = 80;

export interface PlannableEntry {
  localDate: LocalDate;
  text: string;
  photoPath: string | null;
}

export interface PlannedNotification {
  identifier: string;
  fireAt: Date;
  localDate: LocalDate;
  title: string;
  body: string;
  /** Year of the newest memory (its color tints the notification). */
  year: number;
  /** The newest memory's photo, if it has one (shown in the notification where the platform allows). */
  photoPath: string | null;
}

export function firstLine(text: string, max = MAX_FIRST_LINE): string {
  const line = text.trim().split(/\r?\n/)[0]?.trim() ?? '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/**
 * Notification text for a day with at least one matching memory, written as a little letter from
 * your past self:
 *   "💌 A little letter from 2025" / "One year ago today: Coffee with Sam"
 *   "💌 3 little letters from your past self" / "One year ago today: Coffee with Sam · and 2 more 🐰"
 */
export function describeMemories(
  matches: readonly PlannableEntry[],
  day: LocalDate,
): { title: string; body: string; year: number; photoPath: string | null } {
  const newest = matches[0];
  if (!newest) throw new Error('describeMemories needs at least one entry');
  const year = parseLocalDate(newest.localDate).year;
  const lead = yearsAgoLabel(yearsBetween(newest.localDate, day));
  const line = firstLine(newest.text) || (newest.photoPath ? 'a photo you saved 📷' : 'a moment you saved');
  const more = matches.length - 1;
  const title = more > 0 ? `💌 ${matches.length} little letters from your past self` : `💌 A little letter from ${year}`;
  const body = more > 0 ? `${lead}: ${line} · and ${more} more 🐰` : `${lead}: ${line}`;
  return { title, body, year, photoPath: newest.photoPath };
}

/**
 * Plans one notification per day in the window that has an "On this day" match.
 * Pure: give it entries, today, the current instant and the reminder time.
 */
export function planReminders(
  entries: readonly PlannableEntry[],
  options: { today: LocalDate; now: Date; hour: number; minute: number; days?: number },
): PlannedNotification[] {
  const { today, now, hour, minute, days = REMINDER_WINDOW_DAYS } = options;
  const plan: PlannedNotification[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const fireAt = atLocalTime(day, hour, minute);
    if (fireAt.getTime() <= now.getTime()) continue;
    const matches = onThisDay(entries, day);
    if (matches.length === 0) continue;
    plan.push({ identifier: `memory-${day}`, fireAt, localDate: day, ...describeMemories(matches, day) });
  }
  return plan;
}
