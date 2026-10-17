import { weekAverage } from "./weekAverage";
import { addCalendarDays, daysSinceMonday } from "../../dates/calendarDay";

import type { WeekAverageDay } from "./weekAverage";

/**
 * One day of the week as `getDiaryWeek` gives it: its date, the `day_logs` row (null when the day has
 * none, so it is not complete) and the `day_totals` row (null when nothing is logged).
 */
export type WeekSummaryDay = WeekAverageDay & {
  dayLog: { is_complete: boolean } | null;
};

export type WeekSummaryInput = {
  /** The seven days of the week that holds `today`, Monday to Sunday. */
  days: readonly WeekSummaryDay[];
  /** The current local day, `YYYY-MM-DD`, worked out by the caller in the profile's time zone. */
  today: string;
  /** The calorie target, null when none is set. */
  targetKcal: number | null;
};

/** One of the seven day markers: a day so far is `complete`, `open` or `today`, and a day to come is `upcoming`. */
export type WeekDayMarker =
  | { localDate: string; state: "complete" }
  | { localDate: string; state: "open" }
  | { localDate: string; state: "today"; isComplete: boolean }
  | { localDate: string; state: "upcoming" };

export type WeekSummary = {
  /** The week's Monday, `YYYY-MM-DD`. */
  weekStart: string;
  /** The days from Monday up to and including today. */
  daysSoFar: number;
  /** The days so far that are marked complete. */
  daysComplete: number;
  /** The days so far with something logged: the basis the average is taken over. */
  daysLogged: number;
  /** The average kcal over the days logged so far. Null when there is none. */
  averageKcal: number | null;
  /** The calorie target. Null when none is set. */
  targetKcal: number | null;
  /** How full the bar is, from 0 to 1: the average over the target, capped at 1. Null with no target or no average. */
  barFill: number | null;
  /** The whole kcal the average is over the target by, as the card shows them. Null when it is not over. */
  kcalOverTarget: number | null;
  /** The seven days, Monday to Sunday. */
  markers: WeekDayMarker[];
};

const markerOf = (day: WeekSummaryDay, today: string): WeekDayMarker => {
  const { localDate } = day;
  const isComplete = day.dayLog?.is_complete === true;
  if (localDate > today) {
    return { localDate, state: "upcoming" };
  }
  if (localDate === today) {
    return { localDate, state: "today", isComplete };
  }

  return { localDate, state: isComplete ? "complete" : "open" };
};

/**
 * What the Dashboard's "This week" card shows, for the web and the mobile card alike.
 *
 * Two rules, as the diary's week view has them:
 * - Days complete counts Monday up to and including today, as the week strip does (core
 *   `incompleteDaysThisWeek` gives the same count). A day still to come is never counted, even when it
 *   is marked complete. The days so far and the days complete are counted from the same days, so they
 *   always agree with each other and with the markers.
 * - The average leaves out days with nothing logged and days still to come (core `weekAverage`): a day
 *   that was not tracked is not a day of eating nothing.
 *
 * The totals are taken as given. Nothing here compares them with another sum for equality, because the
 * screens sum on the client and `day_totals` sums as exact decimals, so the two can differ in the last digit.
 */
export function weekSummary({ days, today, targetKcal }: WeekSummaryInput): WeekSummary {
  const daysUpToToday = days.filter((day) => day.localDate <= today);
  const averageKcal = weekAverage(days, today)?.kcal ?? null;
  const target = targetKcal !== null && targetKcal > 0 ? targetKcal : null;
  const overTarget = averageKcal === null || target === null ? 0 : Math.round(averageKcal) - target;

  return {
    weekStart: addCalendarDays(today, -daysSinceMonday(today)),
    daysSoFar: daysUpToToday.length,
    daysComplete: daysUpToToday.filter((day) => day.dayLog?.is_complete === true).length,
    daysLogged: daysUpToToday.filter((day) => day.totals !== null).length,
    averageKcal,
    targetKcal: target,
    barFill: averageKcal === null || target === null ? null : Math.min(1, averageKcal / target),
    kcalOverTarget: overTarget > 0 ? overTarget : null,
    markers: days.map((day) => markerOf(day, today)),
  };
}
