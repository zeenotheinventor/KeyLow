import { addCalendarDays } from "../dates";

import type { TrendPoint } from "../engine";

const DAYS_PER_WEEK = 7;

/**
 * The weekly rate of change in kilograms: the last point's trend minus the trend of the point exactly
 * 7 calendar days earlier in the same segment. Negative is loss. Null when there is no such point, as
 * with an empty list, a trend under 8 days old, or a new segment inside the last 7 days. Unrounded.
 */
export function weeklyRateKg(points: readonly TrendPoint[]): number | null {
  const last = points[points.length - 1];
  if (last === undefined) {
    return null;
  }

  const weekEarlier = addCalendarDays(last.date, -DAYS_PER_WEEK);
  const earlier = points.find(
    (point) => point.date === weekEarlier && point.segment === last.segment,
  );

  return earlier === undefined ? null : last.trendKg - earlier.trendKg;
}
