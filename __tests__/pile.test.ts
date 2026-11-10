import { describe, expect, test } from '@jest/globals';
import { fanOrder, fanSlot, swipeTarget } from '../src/lib/pile';

describe('fan layout', () => {
  test('slots are centred and ordered left to right', () => {
    const slots = [0, 1, 2, 3].map((i) => fanSlot(i, 4));
    expect(slots.reduce((a, b) => a + b, 0)).toBeCloseTo(0);
    const order = fanOrder(4);
    const ordered = order.map((i) => fanSlot(i, 4));
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('swipeTarget', () => {
  test('first swipe lifts the newest', () => {
    expect(swipeTarget(null, 1, 4)).toBe(0);
    expect(swipeTarget(null, -1, 4)).toBe(0);
  });
  test('moves to the visual neighbour and stops at the ends', () => {
    const order = fanOrder(4);
    const mid = order.indexOf(0);
    expect(swipeTarget(0, 1, 4)).toBe(order[mid + 1]);
    expect(swipeTarget(0, -1, 4)).toBe(order[mid - 1]);
    const last = order[order.length - 1]!;
    const firstItem = order[0]!;
    expect(swipeTarget(last, 1, 4)).toBe(last);
    expect(swipeTarget(firstItem, -1, 4)).toBe(firstItem);
  });
  test('a single item stays put', () => {
    expect(swipeTarget(0, 1, 1)).toBe(0);
  });
});
