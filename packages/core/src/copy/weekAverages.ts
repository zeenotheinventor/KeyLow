import { REFRESH_PER_100_LABELS } from "./recipeRefresh";
import { describeWeekGridTitle } from "./weekGrid";
import { formatCalories, formatGrams } from "../format/numbers";

import type { NutrientRow } from "./foodDetail";
import type { WeekNutrientAverages, WeekNutrientKey } from "../diary/rules/weekNutrientAverages";

/** The words of the weekly averages page, which the dashboard's This week card opens. */
export const WEEK_AVERAGES = {
  title: "Weekly averages",
  back: "Back",
  dashboard: "Dashboard",
  dailyAverage: "Daily average",
  weekTotal: "Week so far",
  openDiaryWeek: "See each day in the diary",
  /** What the page's averages cover, by the calories bar: today is left out until it is over. */
  rangeCaption: "Mon to yesterday",
  /** On a Monday, when no earlier day of the week is there to average. */
  startsTomorrow: "Your averages start tomorrow.",
  /** From Tuesday on, when no day before today has anything logged. Today's entries do not count. */
  nothingBeforeToday: "Nothing logged before today this week.",
} as const;

/** The name of each nutrient on the page, in the words of the food screens. */
export const WEEK_NUTRIENT_LABELS: Readonly<Record<WeekNutrientKey, string>> =
  REFRESH_PER_100_LABELS;

const withUnit = (key: WeekNutrientKey, value: number): string =>
  key === "kcal" ? `${formatCalories(value)} kcal` : `${formatGrams(value)} g`;

const againstTarget = (key: WeekNutrientKey, value: number, target: number | null): string => {
  if (target === null) {
    return withUnit(key, value);
  }
  const format = key === "kcal" ? formatCalories : formatGrams;

  return `${format(value)} / ${withUnit(key, target)}`;
};

/**
 * The rows of one of the page's two tables, in the order of core `WEEK_NUTRIENT_KEYS`. The daily average
 * sits against the daily target where one is set, "1,681 / 2,200 kcal", and the week so far is the sum
 * alone, "6,725 kcal". A nutrient no logged day gave a value for is null, which the table writes as not given.
 */
export const weekAverageRows = (
  averages: Pick<WeekNutrientAverages, "nutrients">,
  column: "dailyAverage" | "weekTotal",
): NutrientRow[] =>
  averages.nutrients.map((nutrient) => {
    const value = nutrient[column];

    return {
      label: WEEK_NUTRIENT_LABELS[nutrient.key],
      value:
        value === null
          ? null
          : column === "dailyAverage"
            ? againstTarget(nutrient.key, value, nutrient.dailyTarget)
            : withUnit(nutrient.key, value),
    };
  });

/**
 * The page's subtitle, from the week's Monday and today: "Week of Mon 12 Oct, Mon to yesterday". On the
 * Monday itself there is no yesterday in the week, so the title stands alone.
 */
export const describeWeekAveragesSubtitle = (weekStart: string, today: string): string =>
  today === weekStart
    ? describeWeekGridTitle(weekStart)
    : `${describeWeekGridTitle(weekStart)}, ${WEEK_AVERAGES.rangeCaption}`;
