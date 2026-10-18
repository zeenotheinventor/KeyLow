import { addCalendarDays } from "../dates";

import type { TrendPoint } from "../engine";
import type { WeightRange } from "./types";

type DateWindow = Readonly<{
  /** The first day, `YYYY-MM-DD`. */
  from: string;
  /** The last day, `YYYY-MM-DD`. It is today. */
  to: string;
}>;

/**
 * The days a chart range covers, both ends included: `today` and the `range - 1` days before it, so
 * 7 days is today and the six before. Calendar days, so a leap day counts as any other.
 */
export function rangeWindow(range: WeightRange, today: string): DateWindow {
  return { from: addCalendarDays(today, -(range - 1)), to: today };
}

// `YYYY-MM-DD` sorts as text in date order, so the dates compare without being parsed.
const isInWindow = (window: DateWindow, date: string): boolean =>
  date >= window.from && date <= window.to;

/** The trend points inside the range, untouched. A filter, with no recomputation. */
export function pointsInRange(
  points: readonly TrendPoint[],
  range: WeightRange,
  today: string,
): TrendPoint[] {
  const window = rangeWindow(range, today);

  return points.filter((point) => isInWindow(window, point.date));
}

/** The weigh-in rows whose `local_date` is inside the range, untouched and in their order. */
export function weighInsInRange<Row extends Readonly<{ local_date: string }>>(
  rows: readonly Row[],
  range: WeightRange,
  today: string,
): Row[] {
  const window = rangeWindow(range, today);

  return rows.filter((row) => isInWindow(window, row.local_date));
}
