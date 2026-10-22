import { addCalendarDays, daysSinceMonday } from "@keylow/core/dates";
import { hasExerciseGainThisWeek, routineTrendsByDay } from "@keylow/core/training";

import type { TrendSetRows } from "@keylow/api-client";

type RoutineDays = Parameters<typeof routineTrendsByDay>[0];

/**
 * The range the trend is worked out over. It is the Routines page's own, so the rows are the ones that
 * page has already read and kept.
 */
export const WEEKLY_GAIN_RANGE = "3m";

/**
 * Whether any exercise of the routine went up in the week of `today`, in the same trend the Progress section
 * of the Routines page shows. The trend only moves when the week does, so it is worked out from the
 * Monday of the week, as that section does.
 */
export function hasWeeklyGain({
  days,
  rows,
  timeZone,
  today,
}: {
  days: RoutineDays;
  rows: TrendSetRows;
  timeZone: string;
  /** The local calendar day, `YYYY-MM-DD` in `timeZone`. */
  today: string;
}): boolean {
  const currentWeek = addCalendarDays(today, -daysSinceMonday(today));
  const trends = routineTrendsByDay(
    days,
    { sets: rows.sets, earlier: rows.earlier },
    { range: WEEKLY_GAIN_RANGE, now: `${currentWeek}T12:00:00Z`, timeZone },
  ).flatMap(({ exercises }) => exercises.map(({ trend }) => trend));
  return hasExerciseGainThisWeek(trends);
}
