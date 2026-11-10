/** Pure layout logic for the "On this day" pile (no React Native imports). */

/** Position in the fanned hand: newest in the middle, older ones alternating right, left… then re-centred. */
export function fanSlot(index: number, total: number): number {
  const raw = (i: number) => (i === 0 ? 0 : i % 2 === 1 ? (i + 1) / 2 : -i / 2);
  let sum = 0;
  for (let i = 0; i < total; i++) sum += raw(i);
  return raw(index) - sum / total;
}

/** Visual left-to-right order of the fanned items (indices sorted by their fan slot). */
export function fanOrder(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i).sort((a, b) => fanSlot(a, total) - fanSlot(b, total));
}

/**
 * Which item a horizontal swipe lifts next. `direction` 1 = swipe left (move right), -1 = swipe right.
 * Nothing lifted yet: lift the newest (index 0). Stops at the ends (returns the same index).
 */
export function swipeTarget(lifted: number | null, direction: 1 | -1, total: number): number {
  if (lifted === null) return 0;
  const order = fanOrder(total);
  const pos = order.indexOf(lifted);
  const next = order[Math.min(order.length - 1, Math.max(0, pos + direction))];
  return next ?? lifted;
}
