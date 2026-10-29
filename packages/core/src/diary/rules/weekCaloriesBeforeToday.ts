import { daysSinceMonday } from "../../dates/calendarDay";

/** The calories bar of a week's average: the average, the target and how full and how far over the bar is. */
export type WeekAverageBarState = {
  /** The average kcal over the days logged. Null when there is none. */
  averageKcal: number | null;
  /** The calorie target. Null when none is set. */
  targetKcal: number | null;
  /** How full the bar is, from 0 to 1: the average over the target, capped at 1. Null with no target or no average. */
  barFill: number | null;
  /** The whole kcal the average is over the target by, as the bar prints them. Null when it is not over. */
  kcalOverTarget: number | null;
};

/**
 * The calories bar for an average and a target. A target that is not above 0 is left off. The fill is the
 * average over the target, capped at 1, and the overshoot is in whole kcal, as the bar prints it. The This
 * week card and the weekly averages page both take their bar from here, so the two draw it by the same rule.
 */
export function weekAverageBarOf(
  averageKcal: number | null,
  targetKcal: number | null,
): WeekAverageBarState {
  const target = targetKcal !== null && targetKcal > 0 ? targetKcal : null;
  const overTarget = averageKcal === null || target === null ? 0 : Math.round(averageKcal) - target;

  return {
    averageKcal,
    targetKcal: target,
    barFill: averageKcal === null || target === null ? null : Math.min(1, averageKcal / target),
    kcalOverTarget: overTarget > 0 ? overTarget : null,
  };
}

/** A day of the week with its calories: the totals are null when nothing is logged, and the kcal null when no entry gave it. */
export type WeekCaloriesDay = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  totals: { kcal: number | null } | null;
};

export type WeekCaloriesBeforeToday = {
  /** True when today is the Monday, so there is no earlier day of the week to average. */
  isFirstDay: boolean;
  /** The days from Monday to yesterday with something logged: the basis the average is taken over. */
  daysLogged: number;
  /** The calories bar for the average over those days. */
  calories: WeekAverageBarState;
};

/**
 * The week's average calories over the days logged from Monday to yesterday, as the This week card and the
 * weekly averages page both show it. Today is left out because it is not over yet, and a part of a day
 * would pull the average down. A day after today is left out too, and so is a day with nothing logged,
 * because a day that was not tracked is not a day of eating nothing. A logged day with no calories counts
 * as 0, so there is an average whenever a day before today is logged. On a Monday there is no earlier day,
 * which `isFirstDay` says.
 */
export function weekCaloriesBeforeToday(
  days: readonly WeekCaloriesDay[],
  today: string,
  targetKcal: number | null,
): WeekCaloriesBeforeToday {
  const logged = days.flatMap((day) =>
    day.localDate < today && day.totals !== null ? [day.totals.kcal ?? 0] : [],
  );
  const averageKcal =
    logged.length === 0 ? null : logged.reduce((sum, kcal) => sum + kcal, 0) / logged.length;

  return {
    isFirstDay: daysSinceMonday(today) === 0,
    daysLogged: logged.length,
    calories: weekAverageBarOf(averageKcal, targetKcal),
  };
}
