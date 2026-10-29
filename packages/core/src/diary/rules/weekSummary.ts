import { weekCaloriesBeforeToday } from "./weekCaloriesBeforeToday";
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
  /** True when today is the Monday, so there is no earlier day of the week to average. */
  isFirstDay: boolean;
  /** The days from Monday to yesterday with something logged: the basis the average is taken over. */
  daysLogged: number;
  /** The average kcal over the days logged before today. Null when there is none. */
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
 * Two rules:
 * - Days complete counts Monday up to and including today, as the week strip does (core
 *   `incompleteDaysThisWeek` gives the same count). A day still to come is never counted, even when it
 *   is marked complete. The days so far and the days complete are counted from the same days, so they
 *   always agree with each other and with the markers.
 * - The average, its basis and the bar cover the days logged from Monday to yesterday (core
 *   `weekCaloriesBeforeToday`), as the weekly averages page does, so the card and the page agree. Today is
 *   left out until it is over, and a day that was not tracked is not a day of eating nothing.
 *
 * The totals are taken as given. Nothing here compares them with another sum for equality, because the
 * screens sum on the client and `day_totals` sums as exact decimals, so the two can differ in the last digit.
 */
export function weekSummary({ days, today, targetKcal }: WeekSummaryInput): WeekSummary {
  const daysUpToToday = days.filter((day) => day.localDate <= today);
  const { isFirstDay, daysLogged, calories } = weekCaloriesBeforeToday(days, today, targetKcal);

  return {
    weekStart: addCalendarDays(today, -daysSinceMonday(today)),
    daysSoFar: daysUpToToday.length,
    daysComplete: daysUpToToday.filter((day) => day.dayLog?.is_complete === true).length,
    isFirstDay,
    daysLogged,
    ...calories,
    markers: days.map((day) => markerOf(day, today)),
  };
}
