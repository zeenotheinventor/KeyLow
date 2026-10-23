import { addCalendarDays } from "../dates";
import { TREND_SETTLED_OBS } from "./bounds";
import { rangeWindow } from "./ranges";

import type { BodyTrendPoint } from "./bodyTypes";
import type { WeightRange } from "./types";

const MIN_DAYS_APART = 6;

/**
 * Whether the trend is still settling: the last point has fewer than 7 reading days in its segment.
 * False for no points, because there is nothing to settle and the empty state is the screen's.
 */
export function isBodyTrendSettling(points: readonly BodyTrendPoint[]): boolean {
  const last = points[points.length - 1];

  return last !== undefined && last.nObs < TREND_SETTLED_OBS;
}

/** The trend points inside the range, untouched. A filter, with no recomputation. */
export function bodyPointsInRange(
  points: readonly BodyTrendPoint[],
  range: WeightRange,
  today: string,
): BodyTrendPoint[] {
  const { from, to } = rangeWindow(range, today);

  // `YYYY-MM-DD` sorts as text in date order, so the dates compare without being parsed.
  return points.filter((point) => point.date >= from && point.date <= to);
}

/**
 * The change over a range: the last point's trend minus the trend of the first point inside the range
 * window in the same segment. Negative is a fall. Null when there is no such earlier point, as with an
 * empty list, a segment that began inside the window less than 6 days before the last point, or a last
 * point older than the window. Unrounded.
 */
export function bodyChangeOverRange(
  points: readonly BodyTrendPoint[],
  range: WeightRange,
  today: string,
): number | null {
  const last = points[points.length - 1];
  if (last === undefined) {
    return null;
  }

  const first = bodyPointsInRange(points, range, today).find(
    (point) => point.segment === last.segment,
  );
  if (first === undefined) {
    return null;
  }

  const isTooClose = addCalendarDays(first.date, MIN_DAYS_APART) > last.date;
  return isTooClose ? null : last.trend - first.trend;
}
