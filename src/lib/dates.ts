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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 23rd … */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${n % 10 > 3 ? 'th' : suffix}`;
}

/** The date the way a diary writes it at the top of a page: "The 20th of November, 2025". */
export function formatDiaryDate(date: LocalDate): string {
  const { year, month, day } = parseLocalDate(date);
  return `The ${ordinal(day)} of ${MONTHS[month - 1] ?? ''}, ${year}`;
}

export function formatMonthDay(date: LocalDate, locale = 'en-US'): string {
  return atLocalTime(date).toLocaleDateString(locale, { month: 'long', day: 'numeric' });
}

/** "One year ago today", "2 years ago today" */
/**
 * How a reply to your past self is headed, by how long after the memory it was written: "a year on" when it came
 * back on its day a year later, "2 years on", or just "later" for a reply written within the year.
 */
export function replyLabel(entryDate: LocalDate, repliedOn: LocalDate): string {
  const a = parseLocalDate(entryDate);
  const b = parseLocalDate(repliedOn);
  // Whole years that have passed: a year only counts once its day has come round again (a Feb 29 memory comes
  // round on Feb 28 in other years, the same day it comes back).
  const day = a.month === 2 && a.day === 29 && !isLeapYear(b.year) ? 28 : a.day;
  const beforeItsDay = b.month < a.month || (b.month === a.month && b.day < day);
  const years = b.year - a.year - (beforeItsDay ? 1 : 0);
  if (years <= 0) return 'later';
  return years === 1 ? 'a year on' : `${years} years on`;
}

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

/** Roman numerals for the year tooled on a spine (MMXXVI). */
export function romanYear(year: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = year;
  let out = '';
  for (const [v, r] of table) {
    while (n >= v) {
      out += r;
      n -= v;
    }
  }
  return out;
}

/** How far through its calendar year a day is, from 0 (1 January) to 1 (31 December). */
export function yearProgress(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return (Date.UTC(year, month - 1, day) - start) / (end - start - 86400000);
}
