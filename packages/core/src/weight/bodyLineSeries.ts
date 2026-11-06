import { addCalendarDays } from "../dates";
import { rangeWindow } from "./ranges";

import type { BodyTrendPoint } from "./bodyTypes";
import type { WeightRange } from "./types";

/**
 * The trend of each day of the range, oldest first, for the card's line. A day with no point is `null`,
 * which includes the days before the first point, so the line starts where its first day is and is not
 * stretched across the card's width.
 */
export function bodyLineSeries(
  pointsInRange: readonly BodyTrendPoint[],
  range: WeightRange,
  today: string,
): (number | null)[] {
  const trendByDate = new Map(pointsInRange.map((point) => [point.date, point.trend]));
  const { from } = rangeWindow(range, today);

  return Array.from(
    { length: range },
    (_, index) => trendByDate.get(addCalendarDays(from, index)) ?? null,
  );
}
