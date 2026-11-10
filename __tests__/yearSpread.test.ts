import { describe, expect, test } from '@jest/globals';
import { groupByMonth, monthName, scatterLayout, tidyLayout } from '../src/lib/yearSpread';

const scatter = { width: 360, itemW: 110, itemH: 160, columns: 3, scale: 1.2, rowRatio: 0.6, maxTilt: 16 };
const tidy = { itemW: 110, cellH: 160, columns: 3, gap: 10, headerH: 60, groupGap: 20, maxTilt: 2 };

describe('groupByMonth', () => {
  test('January first, oldest first within a month, empty months skipped', () => {
    const groups = groupByMonth([{ localDate: '2025-11-09' }, { localDate: '2025-02-28' }, { localDate: '2025-11-02' }, { localDate: '2025-02-01' }]);
    expect(groups.map((g) => g.month)).toEqual([2, 11]);
    expect(groups[0]?.entries.map((e) => e.localDate)).toEqual(['2025-02-01', '2025-02-28']);
    expect(groups[1]?.entries.map((e) => e.localDate)).toEqual(['2025-11-02', '2025-11-09']);
  });
  test('no entries, no groups', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

test('monthName', () => {
  expect(monthName(1)).toBe('January');
  expect(monthName(12)).toBe('December');
});

describe('scatterLayout', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`);
  test('is stable for the same ids', () => {
    expect(scatterLayout(ids, scatter)).toEqual(scatterLayout(ids, scatter));
  });
  test('keeps every item on the page and within the tilt limit', () => {
    const { slots, height } = scatterLayout(ids, scatter);
    const pad = (scatter.itemW * (scatter.scale - 1)) / 2;
    for (const s of slots) {
      expect(s.x).toBeGreaterThanOrEqual(pad - 1e-6);
      expect(s.x + scatter.itemW + pad).toBeLessThanOrEqual(scatter.width + 1e-6);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y + scatter.itemH).toBeLessThanOrEqual(height);
      expect(Math.abs(s.rotate)).toBeLessThanOrEqual(scatter.maxTilt);
    }
  });
  test('rows overlap', () => {
    const { height } = scatterLayout(ids, scatter);
    expect(height).toBeLessThan(Math.ceil(ids.length / scatter.columns) * scatter.itemH);
  });
  test('empty', () => {
    expect(scatterLayout([], scatter)).toEqual({ slots: [], height: 0 });
  });
});

describe('tidyLayout', () => {
  test('headings sit above their months and items never overlap', () => {
    const { slots, headers, height } = tidyLayout([['a', 'b', 'c', 'd'], ['e']], tidy);
    expect(headers[0]).toBe(0);
    expect(slots[0]?.y).toBe(tidy.headerH);
    // Fourth item wraps to a second row.
    expect(slots[3]?.x).toBe(0);
    expect(slots[3]?.y).toBe(tidy.headerH + tidy.cellH + tidy.gap);
    // Second month starts below everything in the first.
    const firstBottom = (slots[3]?.y ?? 0) + tidy.cellH;
    expect(headers[1]).toBeGreaterThanOrEqual(firstBottom);
    expect(slots[4]?.y).toBe((headers[1] ?? 0) + tidy.headerH);
    expect(height).toBeGreaterThanOrEqual((slots[4]?.y ?? 0) + tidy.cellH);
    expect(slots.every((s) => s.scale === 1 && Math.abs(s.rotate) <= tidy.maxTilt)).toBe(true);
  });
});
