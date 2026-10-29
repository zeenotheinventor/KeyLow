import { weekAverage } from "./weekAverage";
import { weekDayTotals } from "./weekDayTotals";
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
 * of eating nothing. Calories and the three macros are read through `weekDayTotals` and averaged by
 * `weekAverage` itself, so this page cannot disagree with the card. Fibre, saturated fat, sugars and salt
 * are read the same way (a logged day with no value counts as 0, as it does on the day's bars), except that
 * a nutrient no logged day gave a value for is null and is shown as not given, never as 0 g.
 */
export function weekNutrientAverages({
  days,
  today,
  targets,
}: WeekNutrientAveragesInput): WeekNutrientAverages {
  const logged = days.flatMap((day) =>
    day.localDate <= today && day.totals !== null ? [day.totals] : [],
  );
  const macroAverage = weekAverage(
    days.map((day) => ({ localDate: day.localDate, totals: weekDayTotals(day.totals) })),
    today,
  );

  const averageOf = (key: WeekNutrientKey): number | null => {
    if (isTargetKey(key)) {
      return macroAverage?.[key] ?? null;
    }
    if (logged.every((totals) => totals[key] === null)) {
      return null;
    }

    return logged.reduce((sum, totals) => sum + (totals[key] ?? 0), 0) / logged.length;
  };

  return {
    weekStart: addCalendarDays(today, -daysSinceMonday(today)),
    daysLogged: logged.length,
    nutrients: WEEK_NUTRIENT_KEYS.map((key) => {
      const dailyAverage = averageOf(key);

      return {
        key,
        dailyAverage,
        weekTotal: dailyAverage === null ? null : dailyAverage * logged.length,
        dailyTarget: isTargetKey(key) ? positiveOrNull(targets[key]) : null,
      };
    }),
  };
}
