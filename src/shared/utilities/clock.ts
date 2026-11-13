/**
 * Source of "now". Relative labels such as "Today · 07:58" and filters such as
 * "Last seen: 30 days" are computed against it.
 *
 * In fixture mode the clock is pinned to the reference date of the approved designs
 * (21 Oct 2026), so the synthetic records read exactly as in Figma. In API mode it is
 * the browser's system clock.
 */
export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}

export function fixedClock(iso: string): Clock {
  const instant = new Date(iso).getTime()
  return { now: () => new Date(instant) }
}
