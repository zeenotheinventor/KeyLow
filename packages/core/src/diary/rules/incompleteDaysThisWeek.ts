import { toLocalDate } from "../../dates";
import { addCalendarDays, daysSinceMonday } from "../../dates/calendarDay";

/** What `day_logs` says about a day: a day with no row has not been marked complete. */
export type DayCompletion = {
  local_date: string;
  is_complete: boolean;
};

/**
 * How many days from Monday up to and including today are not marked complete. Weeks start on
 * Monday, a future day is never counted, and rows outside the week are ignored. `today` is an
 * instant and `timeZone` says which calendar day it is.
 */
export function incompleteDaysThisWeek(
  days: readonly DayCompletion[],
  today: Date,
  timeZone: string,
): number {
  const todayLocalDate = toLocalDate(today, timeZone);
  const daysSoFar = daysSinceMonday(todayLocalDate) + 1;
  const monday = addCalendarDays(todayLocalDate, -(daysSoFar - 1));

  const completeDays = new Set(
    days
      .filter(
        (day) => day.is_complete && day.local_date >= monday && day.local_date <= todayLocalDate,
      )
      .map((day) => day.local_date),
  );

  return daysSoFar - completeDays.size;
}
