import { describeDateRange, describeShortDate, describeWeekdayName, joinInWords } from "./bodyMap";
import { parseCalendarDay } from "../dates/calendarDay";
import { formatCalories, formatGrams } from "../format/numbers";
import { formatScaledCount } from "../format/scaledCount";
import { shortFoodName } from "../palate/shortFoodName";

import type { FitNutrient } from "../recipes/fit";

/*
 * The words of the plan card, from the approved boards "assistant-card · plan-created" and "plan · day-short"
 * (docs/design/kitchen/proposals/kitchen-plan.md). Every figure is core's sum, formatted here and never typed
 * by a model.
 */

const BAND_NAMES = { morning: "Morning", midday: "Midday", evening: "Evening" } as const;

const NUTRIENT_WORDS: Record<FitNutrient, string> = {
  kcal: "calories",
  protein_g: "protein",
  carbs_g: "carbs",
  fat_g: "fat",
};

const pluralOf = (count: number, one: string, many: string): string =>
  `${formatScaledCount(count)} ${count === 1 ? one : many}`;

/** "Planned 7 days, Mon 16 to Sun 22 Nov", or "Planned Wed 18 Nov" for one day. */
export const describePlanCreatedTitle = (
  startDate: string,
  endDate: string,
  dayCount: number,
): string =>
  dayCount === 1
    ? `Planned ${describeShortDate(startDate)}`
    : `Planned ${dayCount} days, ${describeDateRange(startDate, endDate)}`;

/** The line under "Undone": "Removed the plan for Mon 16 to Sun 22 Nov". */
export const describePlanUndone = (startDate: string, endDate: string): string =>
  `Removed the plan for ${describeDateRange(startDate, endDate)}`;

/** The short fact the changes list shows: "7 days". */
export const describePlanChange = (dayCount: number): string => pluralOf(dayCount, "day", "days");

/** The day row's name, "Monday 16 · 1,296 of 1,300 kcal". With no target or no figure only what is known is said. */
export const describePlanDayName = (
  localDate: string,
  kcal: number | null,
  kcalTarget: number | null,
): string => {
  const day = `${describeWeekdayName(localDate)} ${parseCalendarDay(localDate).day}`;
  if (kcal === null) {
    return day;
  }
  return kcalTarget === null
    ? `${day} · ${formatCalories(kcal)} kcal`
    : `${day} · ${formatCalories(kcal)} of ${formatCalories(kcalTarget)} kcal`;
};

/** The day row's summary, "5 items · P 86 of 90 g". */
export const describePlanDaySummary = (
  itemCount: number,
  protein: number | null,
  proteinTarget: number | null,
): string => {
  const count = pluralOf(itemCount, "item", "items");
  if (protein === null) {
    return count;
  }
  return proteinTarget === null
    ? `${count} · P ${formatGrams(protein)} g`
    : `${count} · P ${formatGrams(protein)} of ${formatGrams(proteinTarget)} g`;
};

/** An item's detail line, "Morning 07:30 · 1 serving · 340 g", with "leftover" when another day cooked it. */
export const describePlanItemDetail = (input: {
  band: keyof typeof BAND_NAMES;
  time: string;
  amount: string;
  isLeftover: boolean;
}): string =>
  [
    `${BAND_NAMES[input.band]} ${input.time}`,
    input.amount,
    ...(input.isLeftover ? ["leftover"] : []),
  ].join(" · ");

/** A recipe item's amount: "1 serving · 340 g", the weight left out when the recipe has none. */
export const describePlanRecipeAmount = (servingGrams: number | null): string =>
  servingGrams === null ? "1 serving" : `1 serving · ${formatGrams(servingGrams)} g`;

export const describePlanFoodAmount = (grams: number): string => `${formatGrams(grams)} g`;

/** What a plan calls a food: its name up to the first comma, with a capital ("Porridge oats"). */
export const describePlanFoodName = (name: string): string => {
  const short = shortFoodName(name);
  return `${short.charAt(0).toUpperCase()}${short.slice(1)}`;
};

const timesAWeek = (limit: number): string =>
  limit === 1 ? "once a week" : limit === 2 ? "twice a week" : `${limit} times a week`;

/** Where the repeat limit of a plan came from. */
export type RepeatLimitSource = "request" | "profile" | "default";

/**
 * The note that says which limit applied. No limit says nothing, as the board does. Only the starting limit
 * tells the person where to change it.
 */
export const describeRepeatLimitNote = (
  limit: number | null,
  source: RepeatLimitSource,
): string | null => {
  if (limit === null) {
    return null;
  }
  const base = `Recipes repeat up to ${timesAWeek(limit)}`;
  return source === "default"
    ? `${base}. Change it in plan settings.`
    : source === "profile"
      ? `${base}, as set in plan settings.`
      : `${base}, as you asked.`;
};

type Miss = {
  nutrient: FitNutrient;
  target: number;
  achieved: number | null;
  reason: string;
};

/** "22 g short on protein", "180 kcal under" or "120 kcal over". An unknown figure says so. */
const describeMiss = ({ nutrient, target, achieved }: Miss): string => {
  if (achieved === null) {
    return `missing a ${NUTRIENT_WORDS[nutrient]} figure`;
  }
  const gap = achieved - target;
  if (nutrient === "kcal") {
    return `${formatCalories(Math.abs(gap))} kcal ${gap < 0 ? "under" : "over"}`;
  }
  return `${formatGrams(Math.abs(gap))} g ${gap < 0 ? "short on" : "over on"} ${NUTRIENT_WORDS[nutrient]}`;
};

/**
 * The note for a day that missed. A miss the planner proved (a fitter reason) is said as a figure, and one it
 * only ran out of work on (`work_limit`) is said as what it is, never as the closest the plan gets.
 */
export const describeShortDayNote = (localDate: string, misses: readonly Miss[]): string => {
  const date = describeShortDate(localDate);
  const proven = misses.filter(({ reason }) => reason !== "work_limit");
  const unproven = misses.length > proven.length;
  const parts = [
    ...(proven.length > 0 ? [`${date} is ${joinInWords(proven.map(describeMiss))}.`] : []),
    ...(unproven
      ? [
          `${date} was not fully worked out, so it may not be as close as it can get. Ask me to replan it.`,
        ]
      : []),
  ];
  return parts.join(" ");
};

/** What `plan_meals` tells the model when it saved no plan, so it can say so plainly. */
export const PLAN_NOT_SAVED_WORDS = {
  generation_refused: "The planner declined that request, so no plan was made.",
  generation_timeout: "Planning took too long, so no plan was made. Try again.",
  generation_failed:
    "The planner could not be reached, so no plan was made. Try again in a moment.",
  no_calorie_target: "There is no calorie target to plan against yet, so no plan was made.",
  nothing_to_plan_from:
    "There are no recipes or usual foods to plan from yet, so no plan was made.",
} as const;
