import { addCalendarDays } from "../../src/dates";

import type { TrendPoint } from "../../src/engine";

/** A trend point with the fields that do not matter to the test filled in. */
export function trendPoint(overrides: Partial<TrendPoint> & Pick<TrendPoint, "date">): TrendPoint {
  return {
    segment: 0,
    trendKg: 80,
    rawKg: 80,
    usedKg: 80,
    rejected: false,
    winsorised: false,
    interpolated: false,
    nObs: 1,
    ...overrides,
  };
}

/** One daily point per day from `start`, with a trend that falls by `fallPerDayKg` a day from 100 kg. */
export function fallingPoints(start: string, days: number, fallPerDayKg: number): TrendPoint[] {
  return Array.from({ length: days }, (_, index) =>
    trendPoint({ date: addCalendarDays(start, index), trendKg: 100 - fallPerDayKg * index }),
  );
}

/** The trend of the point at `index`. Throws when there is none, so a test never reads past the end. */
export function trendKgAt(points: readonly TrendPoint[], index: number): number {
  const point = points[index];
  if (point === undefined) {
    throw new RangeError(`No point at index ${index}.`);
  }
  return point.trendKg;
}
