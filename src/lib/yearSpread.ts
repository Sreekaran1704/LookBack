/**
 * Layouts for a year's entries: a scattered pile (everything thrown on the page) and a tidy
 * month-by-month arrangement. Pure module (no React Native imports); every position is seeded
 * by the entry id, so the pile looks the same each time the year is opened.
 */
import { parseLocalDate, type Dated } from './dates';
import { seededRng } from './seeded';

/** Top-left position of an item's unscaled box, plus the rotation and scale applied around its centre. */
export interface Slot {
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

export interface MonthGroup<T> {
  /** 1–12 */
  month: number;
  entries: T[];
}

/** Entries grouped by calendar month, January first; oldest first within a month. Empty months are left out. */
export function groupByMonth<T extends Dated>(entries: readonly T[]): MonthGroup<T>[] {
  const sorted = [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const groups: MonthGroup<T>[] = [];
  for (const entry of sorted) {
    const { month } = parseLocalDate(entry.localDate);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }
  return groups;
}

/** "January" */
export function monthName(month: number, locale = 'en-US'): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(locale, { month: 'long' });
}

export interface ScatterOptions {
  width: number;
  itemW: number;
  itemH: number;
  columns: number;
  /** Items are drawn larger than their box so they overlap. */
  scale: number;
  /** Row pitch as a share of the item height (under 1 = rows overlap). */
  rowRatio: number;
  maxTilt: number;
}

export interface Layout {
  slots: Slot[];
  height: number;
}

/** A loose pile: rows and columns that overlap, with seeded jitter and tilt. Later items land on top. */
export function scatterLayout(ids: readonly string[], o: ScatterOptions): Layout {
  const pad = (o.itemW * (o.scale - 1)) / 2;
  const maxX = Math.max(pad, o.width - o.itemW - pad);
  const step = o.columns > 1 ? (maxX - pad) / (o.columns - 1) : 0;
  const pitch = o.itemH * o.rowRatio;
  const slots = ids.map((id, i) => {
    const rng = seededRng(`scatter-${id}`);
    const col = i % o.columns;
    const row = Math.floor(i / o.columns);
    const x = pad + col * step + rng.range(-o.itemW * 0.14, o.itemW * 0.14);
    const y = pad + row * pitch + rng.range(-o.itemH * 0.1, o.itemH * 0.1);
    return {
      x: Math.min(maxX, Math.max(pad, x)),
      y: Math.max(0, y),
      rotate: rng.range(-o.maxTilt, o.maxTilt),
      scale: o.scale,
    };
  });
  const rows = Math.ceil(ids.length / o.columns);
  const height = rows === 0 ? 0 : pad * 2 + (rows - 1) * pitch + o.itemH * o.scale;
  return { slots, height };
}

export interface TidyOptions {
  itemW: number;
  cellH: number;
  columns: number;
  gap: number;
  /** Space reserved for each month's heading. */
  headerH: number;
  /** Extra space after each month. */
  groupGap: number;
  maxTilt: number;
}

export interface TidyLayout extends Layout {
  /** Top of each month's heading, in group order. */
  headers: number[];
}

/**
 * Month by month: a heading, then that month's items in a neat grid. `groups` holds the ids of each
 * month in display order; the returned slots follow the same flattened order.
 */
export function tidyLayout(groups: readonly (readonly string[])[], o: TidyOptions): TidyLayout {
  const slots: Slot[] = [];
  const headers: number[] = [];
  let y = 0;
  for (const ids of groups) {
    headers.push(y);
    y += o.headerH;
    ids.forEach((id, j) => {
      const rng = seededRng(`tidy-${id}`);
      slots.push({
        x: (j % o.columns) * (o.itemW + o.gap),
        y: y + Math.floor(j / o.columns) * (o.cellH + o.gap),
        rotate: rng.range(-o.maxTilt, o.maxTilt),
        scale: 1,
      });
    });
    y += Math.ceil(ids.length / o.columns) * (o.cellH + o.gap) + o.groupGap;
  }
  return { slots, headers, height: y };
}
