/**
 * Pure calendar-date logic. No React Native imports so it runs in plain Jest.
 *
 * A LocalDate is the user's local calendar day as 'YYYY-MM-DD'. Never derive it from
 * toISOString() (that is UTC and shifts the day for anyone not on UTC).
 */

export type LocalDate = string;

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isValidLocalDate(value: string): boolean {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseLocalDate(value: LocalDate): DateParts {
  if (!isValidLocalDate(value)) {
    throw new Error(`Invalid local date: "${value}"`);
  }
  const [y, m, d] = value.split('-');
  return { year: Number(y), month: Number(m), day: Number(d) };
}

export function formatLocalDate({ year, month, day }: DateParts): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The device's current local calendar date (or that of the given instant). */
export function toLocalDate(instant: Date = new Date()): LocalDate {
  return formatLocalDate({
    year: instant.getFullYear(),
    month: instant.getMonth() + 1,
    day: instant.getDate(),
  });
}

/** A Date at the given local wall-clock time on that calendar day. */
export function atLocalTime(date: LocalDate, hour = 0, minute = 0): Date {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  // Noon avoids DST edge cases where midnight does not exist.
  return toLocalDate(new Date(year, month - 1, day + days, 12));
}

/**
 * Does an entry saved on `entryDate` belong in the "On this day" view for `today`?
 * Same month and day in an earlier year. Feb 29 entries surface on Feb 28 in non-leap years.
 */
export function matchesOnThisDay(entryDate: LocalDate, today: LocalDate): boolean {
  const e = parseLocalDate(entryDate);
  const t = parseLocalDate(today);
  if (e.year >= t.year) return false;
  if (e.month === t.month && e.day === t.day) return true;
  const entryIsLeapDay = e.month === 2 && e.day === 29;
  const todayIsFeb28 = t.month === 2 && t.day === 28;
  return entryIsLeapDay && todayIsFeb28 && !isLeapYear(t.year);
}

export interface Dated {
  localDate: LocalDate;
}

/** Entries matching today from earlier years, most recent year first. */
export function onThisDay<T extends Dated>(entries: readonly T[], today: LocalDate): T[] {
  return entries
    .filter((e) => matchesOnThisDay(e.localDate, today))
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
}

export function yearsBetween(entryDate: LocalDate, today: LocalDate): number {
  return parseLocalDate(today).year - parseLocalDate(entryDate).year;
}

export interface YearGroup<T> {
  year: number;
  entries: T[];
}

/** Groups entries by calendar year, newest year first, newest entry first within a year. */
export function groupByYear<T extends Dated>(entries: readonly T[]): YearGroup<T>[] {
  const byYear = new Map<number, T[]>();
  for (const entry of entries) {
    const { year } = parseLocalDate(entry.localDate);
    const list = byYear.get(year);
    if (list) list.push(entry);
    else byYear.set(year, [entry]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({
      year,
      entries: [...list].sort((a, b) => b.localDate.localeCompare(a.localDate)),
    }));
}

/**
 * The date an entry will come back as a memory: same day next year.
 * Feb 29 resurfaces on Feb 28 (the following year is never a leap year).
 */
export function resurfaceDate(date: LocalDate): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const nextYear = year + 1;
  const safeDay = Math.min(day, daysInMonth(nextYear, month));
  return formatLocalDate({ year: nextYear, month, day: safeDay });
}

/** "Nov 9, 2027" */
export function formatDisplayDate(date: LocalDate, locale = 'en-US'): string {
  return atLocalTime(date).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "November 9" */
export function formatMonthDay(date: LocalDate, locale = 'en-US'): string {
  return atLocalTime(date).toLocaleDateString(locale, { month: 'long', day: 'numeric' });
}

/** "One year ago today", "2 years ago today" */
export function yearsAgoLabel(years: number): string {
  if (years === 1) return 'One year ago today';
  return `${years} years ago today`;
}

/**
 * Heading for a memory's detail view. "… ago today" only when the entry really is on this day;
 * other past entries just say how many calendar years back they are.
 */
export function memoryKicker(entryDate: LocalDate, today: LocalDate): string {
  if (entryDate === today) return 'Today';
  const years = yearsBetween(entryDate, today);
  if (matchesOnThisDay(entryDate, today)) return yearsAgoLabel(years);
  if (years <= 0) return 'Earlier this year';
  if (years === 1) return 'Last year';
  return `${years} years ago`;
}

/** Same month/day shifted by whole years; Feb 29 clamps to Feb 28 when needed. */
export function shiftYears(date: LocalDate, years: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const target = year + years;
  return formatLocalDate({ year: target, month, day: Math.min(day, daysInMonth(target, month)) });
}
