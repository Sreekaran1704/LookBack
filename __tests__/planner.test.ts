import { describe, expect, test } from '@jest/globals';
import { firstLine, planReminders } from '../src/notifications/planner';

const entry = (localDate: string, text = '', photoPath: string | null = null) => ({
  localDate,
  text,
  photoPath,
});

describe('planReminders', () => {
  const now = new Date(2026, 10, 9, 8, 0); // Nov 9 2026, 08:00 local

  test('schedules only days with a past-year match, at the chosen time', () => {
    const plan = planReminders(
      [entry('2025-11-09', 'Coffee with Sam\nsecond line'), entry('2025-11-12', 'Rain'), entry('2026-11-10', 'too new')],
      { today: '2026-11-09', now, hour: 9, minute: 30 },
    );
    expect(plan.map((p) => p.localDate)).toEqual(['2026-11-09', '2026-11-12']);
    expect(plan[0]?.body).toBe('One year ago today: Coffee with Sam');
    expect(plan[0]?.fireAt).toEqual(new Date(2026, 10, 9, 9, 30));
    expect(plan[0]?.identifier).toBe('memory-2026-11-09');
  });

  test('skips today when the reminder time has already passed', () => {
    const plan = planReminders([entry('2025-11-09', 'x')], {
      today: '2026-11-09',
      now,
      hour: 7,
      minute: 0,
    });
    expect(plan).toEqual([]);
  });

  test('stays within the 30 day window', () => {
    const plan = planReminders([entry('2025-12-08', 'in'), entry('2025-12-09', 'out')], {
      today: '2026-11-09',
      now,
      hour: 9,
      minute: 0,
    });
    expect(plan.map((p) => p.localDate)).toEqual(['2026-12-08']);
  });

  test('several years on the same day: count title, newest first', () => {
    const plan = planReminders(
      [entry('2023-11-10', 'old'), entry('2024-11-10', 'newer')],
      { today: '2026-11-09', now, hour: 9, minute: 0 },
    );
    expect(plan[0]?.title).toBe('2 memories from today');
    expect(plan[0]?.body).toBe('2 years ago today: newer');
  });

  test('photo-only entry gets a friendly fallback line', () => {
    const plan = planReminders([entry('2025-11-09', '', 'photos/a.jpg')], {
      today: '2026-11-09',
      now,
      hour: 9,
      minute: 0,
    });
    expect(plan[0]?.body).toBe('One year ago today: A photo you saved');
  });

  test('Feb 29 entry is planned for Feb 28 in a non-leap year', () => {
    const plan = planReminders([entry('2024-02-29', 'Leap day')], {
      today: '2025-02-20',
      now: new Date(2025, 1, 20, 8, 0),
      hour: 9,
      minute: 0,
    });
    expect(plan.map((p) => p.localDate)).toEqual(['2025-02-28']);
  });
});

describe('firstLine', () => {
  test('trims and truncates', () => {
    expect(firstLine('  hello  \nworld')).toBe('hello');
    expect(firstLine('a'.repeat(100), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});
