import { weekCaloriesBeforeToday } from "./weekCaloriesBeforeToday";
import { addCalendarDays, daysSinceMonday } from "../../dates/calendarDay";

import type { ProgressTargets } from "./progressBars";
import type { WeekAverageBarState } from "./weekCaloriesBeforeToday";

/** Every nutrient a `day_totals` row carries, in the order the weekly averages page lists them. */
export const WEEK_NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fibre_g",
  "sat_fat_g",
  "sugars_g",
  "salt_g",
] as const;

export type WeekNutrientKey = (typeof WEEK_NUTRIENT_KEYS)[number];

/** A day's nutrients as `day_totals` gives them: each null when no entry of the day gave a value. */
export type WeekNutrientDayTotals = { [Key in WeekNutrientKey]: number | null };

export type WeekNutrientAveragesDay = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  /** Null when the day has no entries. */
  totals: WeekNutrientDayTotals | null;
};

export type WeekNutrientAveragesInput = {
  /** The seven days of the week that holds `today`, Monday to Sunday. */
  days: readonly WeekNutrientAveragesDay[];
  /** The current local day, `YYYY-MM-DD`, worked out by the caller in the profile's time zone. */
  today: string;
  /** The daily targets. A target that is not set, or is not above 0, is left off. */
  targets: ProgressTargets;
};

export type WeekNutrientAverage = {
  key: WeekNutrientKey;
  /** The mean of the days logged before today. Null when there is none, or when no such day gave a value for it. */
  dailyAverage: number | null;
  /** The sum of the days logged before today. Null exactly when the daily average is. */
  weekTotal: number | null;
  /** The daily target. Null when none is set, and always null for fibre, saturated fat, sugars and salt. */
  dailyTarget: number | null;
};

export type WeekNutrientAverages = {
  /** The week's Monday, `YYYY-MM-DD`. */
  weekStart: string;
  /** True when today is the Monday, so there is no earlier day of the week to average. */
  isFirstDay: boolean;
  /** The days from Monday to yesterday with something logged: the basis every average is taken over. */
  daysLogged: number;
  /** Every nutrient, in the order of `WEEK_NUTRIENT_KEYS`. */
  nutrients: WeekNutrientAverage[];
  /** The calories bar for the daily average, as the This week card draws it (core `weekCaloriesBeforeToday`). */
  calories: WeekAverageBarState;
};

const TARGET_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

type TargetKey = (typeof TARGET_KEYS)[number];

const isTargetKey = (key: WeekNutrientKey): key is TargetKey =>
  (TARGET_KEYS as readonly WeekNutrientKey[]).includes(key);

const positiveOrNull = (value: number | null): number | null =>
  value !== null && value > 0 ? value : null;

/**
 * What the weekly averages page shows: for every nutrient, the daily average and the total over the days
 * logged this week before today, with the daily target where one exists.
 *
 * Today is left out because it is not over yet, and a part of a day would pull the average down. A day
 * after today is left out too, and so is a day with nothing logged, because a day that was not tracked is
 * not a day of eating nothing. The days logged, the first day and the calories bar come from core
 * `weekCaloriesBeforeToday`, as the This week card's do, so the page and the card always agree. The diary's
 * week view still counts today (core `weekAverage`). On a Monday there is no earlier day, which
 * `isFirstDay` says. A logged day with no value for a nutrient counts as 0, as it does on the day's bars
 * (core `weekDayTotals`). A nutrient no logged day gave a value for is null, shown as not given, never 0 g.
 */
export function weekNutrientAverages({
  days,
  today,
  targets,
}: WeekNutrientAveragesInput): WeekNutrientAverages {
  const logged = days.flatMap((day) =>
    day.localDate < today && day.totals !== null ? [day.totals] : [],
  );
  // Null when no logged day gave a value, which also covers a week with nothing logged.
  const totalOf = (key: WeekNutrientKey): number | null =>
    logged.every((totals) => totals[key] === null)
      ? null
      : logged.reduce((sum, totals) => sum + (totals[key] ?? 0), 0);

  const nutrients = WEEK_NUTRIENT_KEYS.map((key) => {
    const weekTotal = totalOf(key);

    return {
      key,
      dailyAverage: weekTotal === null ? null : weekTotal / logged.length,
      weekTotal,
      dailyTarget: isTargetKey(key) ? positiveOrNull(targets[key]) : null,
    };
  });
  const { isFirstDay, daysLogged, calories } = weekCaloriesBeforeToday(days, today, targets.kcal);

  return {
    weekStart: addCalendarDays(today, -daysSinceMonday(today)),
    isFirstDay,
    daysLogged,
    nutrients,
    calories,
  };
}
