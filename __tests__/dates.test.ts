import { describe, expect, test } from '@jest/globals';
import {
  addDays,
  formatDisplayDate,
  groupByYear,
  isLeapYear,
  isValidLocalDate,
  matchesOnThisDay,
  onThisDay,
  parseLocalDate,
  resurfaceDate,
  shiftYears,
  toLocalDate,
  yearsAgoLabel,
  memoryKicker,
} from '../src/lib/dates';

describe('local date basics', () => {
  test('toLocalDate uses local calendar parts, not UTC', () => {
    // 23:30 local time stays on the same local day no matter the zone.
    expect(toLocalDate(new Date(2026, 10, 9, 23, 30))).toBe('2026-11-09');
    expect(toLocalDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });

  test('validates and parses', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2025-02-29')).toBe(false);
    expect(isValidLocalDate('2025-13-01')).toBe(false);
    expect(isValidLocalDate('2025-1-01')).toBe(false);
    expect(parseLocalDate('2025-03-07')).toEqual({ year: 2025, month: 3, day: 7 });
    expect(() => parseLocalDate('nope')).toThrow();
  });

  test('leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  test('addDays crosses month, year and leap boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('matchesOnThisDay', () => {
  test('same month and day in an earlier year matches', () => {
    expect(matchesOnThisDay('2025-11-09', '2026-11-09')).toBe(true);
    expect(matchesOnThisDay('2019-11-09', '2026-11-09')).toBe(true);
  });

  test('same year or later never matches', () => {
    expect(matchesOnThisDay('2026-11-09', '2026-11-09')).toBe(false);
    expect(matchesOnThisDay('2027-11-09', '2026-11-09')).toBe(false);
  });

  test('different day does not match', () => {
    expect(matchesOnThisDay('2025-11-08', '2026-11-09')).toBe(false);
    expect(matchesOnThisDay('2025-10-09', '2026-11-09')).toBe(false);
  });

  test('Feb 29 surfaces on Feb 28 in non-leap years', () => {
    expect(matchesOnThisDay('2024-02-29', '2025-02-28')).toBe(true);
    expect(matchesOnThisDay('2024-02-29', '2027-02-28')).toBe(true);
  });

  test('Feb 29 surfaces only on Feb 29 in leap years', () => {
    expect(matchesOnThisDay('2024-02-29', '2028-02-29')).toBe(true);
    expect(matchesOnThisDay('2024-02-29', '2028-02-28')).toBe(false);
  });

  test('Feb 29 never surfaces on Mar 1', () => {
    expect(matchesOnThisDay('2024-02-29', '2025-03-01')).toBe(false);
  });

  test('ordinary Feb 28 entries still match Feb 28', () => {
    expect(matchesOnThisDay('2024-02-28', '2025-02-28')).toBe(true);
    expect(matchesOnThisDay('2023-02-28', '2024-02-28')).toBe(true);
  });
});

describe('onThisDay', () => {
  const entries = [
    { id: 'a', localDate: '2023-11-09' },
    { id: 'b', localDate: '2025-11-09' },
    { id: 'c', localDate: '2025-11-10' },
    { id: 'd', localDate: '2026-11-09' },
    { id: 'e', localDate: '2024-11-09' },
  ];

  test('returns earlier-year matches, most recent first', () => {
    expect(onThisDay(entries, '2026-11-09').map((e) => e.id)).toEqual(['b', 'e', 'a']);
  });

  test('mixes Feb 28 and Feb 29 entries on Feb 28 of a non-leap year', () => {
    const feb = [
      { id: 'leap', localDate: '2024-02-29' },
      { id: 'normal', localDate: '2025-02-28' },
    ];
    expect(onThisDay(feb, '2026-02-28').map((e) => e.id)).toEqual(['normal', 'leap']);
  });
});

describe('groupByYear', () => {
  test('groups newest year first, newest entry first', () => {
    const groups = groupByYear([
      { localDate: '2024-01-05' },
      { localDate: '2025-06-01' },
      { localDate: '2024-12-31' },
      { localDate: '2025-01-01' },
      { localDate: '2026-11-09' },
    ]);
    expect(groups.map((g) => g.year)).toEqual([2026, 2025, 2024]);
    expect(groups[1]?.entries.map((e) => e.localDate)).toEqual(['2025-06-01', '2025-01-01']);
    expect(groups[2]?.entries.map((e) => e.localDate)).toEqual(['2024-12-31', '2024-01-05']);
  });

  test('empty input gives no groups', () => {
    expect(groupByYear([])).toEqual([]);
  });
});

describe('resurfaceDate and labels', () => {
  test('same day next year', () => {
    expect(resurfaceDate('2026-11-09')).toBe('2027-11-09');
  });

  test('Feb 29 resurfaces on Feb 28', () => {
    expect(resurfaceDate('2028-02-29')).toBe('2029-02-28');
  });

  test('display format', () => {
    expect(formatDisplayDate('2027-11-09')).toBe('Nov 9, 2027');
  });

  test('years ago label', () => {
    expect(yearsAgoLabel(1)).toBe('One year ago today');
    expect(yearsAgoLabel(3)).toBe('3 years ago today');
  });
});

describe('shiftYears', () => {
  test('moves whole years and clamps leap day', () => {
    expect(shiftYears('2026-11-09', -1)).toBe('2025-11-09');
    expect(shiftYears('2028-02-29', -1)).toBe('2027-02-28');
    expect(shiftYears('2028-02-29', -4)).toBe('2024-02-29');
  });
});

describe('memoryKicker', () => {
  test('says "today" only for a real on-this-day match', () => {
    expect(memoryKicker('2026-11-09', '2026-11-09')).toBe('Today');
    expect(memoryKicker('2025-11-09', '2026-11-09')).toBe('One year ago today');
    expect(memoryKicker('2024-11-09', '2026-11-09')).toBe('2 years ago today');
    expect(memoryKicker('2024-02-29', '2025-02-28')).toBe('One year ago today');
  });
  test('uses plain year counts for other dates', () => {
    expect(memoryKicker('2024-11-18', '2026-11-09')).toBe('2 years ago');
    expect(memoryKicker('2025-12-01', '2026-11-09')).toBe('Last year');
    expect(memoryKicker('2026-03-01', '2026-11-09')).toBe('Earlier this year');
  });
});
