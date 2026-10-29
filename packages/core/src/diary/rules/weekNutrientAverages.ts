import { addCalendarDays, daysSinceMonday } from "../../dates/calendarDay";

import type { ProgressTargets } from "./progressBars";

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
  /** The mean of the days logged so far. Null when nothing is logged, or when no day gave a value for it. */
  dailyAverage: number | null;
  /** The sum of the days logged so far. Null exactly when the daily average is. */
  weekTotal: number | null;
  /** The daily target. Null when none is set, and always null for fibre, saturated fat, sugars and salt. */
  dailyTarget: number | null;
};

export type WeekNutrientAverages = {
  /** The week's Monday, `YYYY-MM-DD`. */
  weekStart: string;
  /** The days so far with something logged: the basis every average is taken over. */
  daysLogged: number;
  /** Every nutrient, in the order of `WEEK_NUTRIENT_KEYS`. */
  nutrients: WeekNutrientAverage[];
};

const TARGET_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

type TargetKey = (typeof TARGET_KEYS)[number];

const isTargetKey = (key: WeekNutrientKey): key is TargetKey =>
  (TARGET_KEYS as readonly WeekNutrientKey[]).includes(key);

const positiveOrNull = (value: number | null): number | null =>
  value !== null && value > 0 ? value : null;

/**
 * What the weekly averages page shows: for every nutrient, the daily average and the total over the days
 * logged so far this week, with the daily target where one exists.
 *
 * The rule is the one the This week card and the diary's week view use (core `weekAverage`): a day after
 * today is left out, and so is a day with nothing logged, because a day that was not tracked is not a day
 * of eating nothing. A logged day with no value for a nutrient counts as 0, as it does on the day's bars
 * (core `weekDayTotals`), and the sum is taken in the same order, so calories and the macros always equal
 * the card's average. A nutrient no logged day gave a value for is null, shown as not given, never 0 g.
 */
export function weekNutrientAverages({
  days,
  today,
  targets,
}: WeekNutrientAveragesInput): WeekNutrientAverages {
  const logged = days.flatMap((day) =>
    day.localDate <= today && day.totals !== null ? [day.totals] : [],
  );
  // Null when no logged day gave a value, which also covers a week with nothing logged.
  const totalOf = (key: WeekNutrientKey): number | null =>
    logged.every((totals) => totals[key] === null)
      ? null
      : logged.reduce((sum, totals) => sum + (totals[key] ?? 0), 0);

  return {
    weekStart: addCalendarDays(today, -daysSinceMonday(today)),
    daysLogged: logged.length,
    nutrients: WEEK_NUTRIENT_KEYS.map((key) => {
      const weekTotal = totalOf(key);

      return {
        key,
        dailyAverage: weekTotal === null ? null : weekTotal / logged.length,
        weekTotal,
        dailyTarget: isTargetKey(key) ? positiveOrNull(targets[key]) : null,
      };
    }),
  };
}
