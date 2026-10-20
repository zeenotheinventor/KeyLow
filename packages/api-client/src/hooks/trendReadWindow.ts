import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { TREND_RANGE_WEEKS } from "@keylow/core/training";

import { weekStartOf } from "../weekStartOf";

import type { TrendRange } from "@keylow/core/training";

const DAYS_PER_WEEK = 7;

/**
 * The days a trend range reads, from the Monday of its first whole week through today in the user's
 * zone, both `YYYY-MM-DD`. `now` is an ISO timestamp with a zone. The Monday is what a trend key carries.
 */
export function trendReadWindow(
  range: TrendRange,
  now: string,
  timeZone: string,
): { fromWeek: string; throughDay: string } {
  const throughDay = toLocalDate(new Date(now), timeZone);
  return {
    fromWeek: addCalendarDays(
      weekStartOf(throughDay),
      -(TREND_RANGE_WEEKS[range] - 1) * DAYS_PER_WEEK,
    ),
    throughDay,
  };
}
