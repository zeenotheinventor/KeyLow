import { MEAL_PLAN_MAX_DAYS, repeatLimitOfProfile } from "./constants";
import { addCalendarDays, daysSinceMonday } from "../dates/calendarDay";

import type { RepeatLimitSource } from "../copy/assistantPlanCards";
import type { FitTarget } from "../recipes/fit";

/** The consecutive days a plan covers, `YYYY-MM-DD`. */
export const planDatesOf = (startDate: string, dayCount: number | null): string[] => {
  const days = dayCount ?? daysUntilSunday(startDate);
  return Array.from({ length: Math.min(days, MEAL_PLAN_MAX_DAYS) }, (_, offset) =>
    addCalendarDays(startDate, offset),
  );
};

/**
 * Asked for no number of days, a plan runs from its first day to the coming Sunday, so a Monday gets the whole
 * week. A Sunday gets the next seven days, because a plan of one day would not be what was asked for.
 */
const daysUntilSunday = (startDate: string): number => {
  const sinceMonday = daysSinceMonday(startDate);
  return sinceMonday === 6 ? MEAL_PLAN_MAX_DAYS : 7 - sinceMonday;
};

/** What a person's day targets are, as the planner judges a day. */
export type DayTargetFigures = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/**
 * The target the planner judges a day by: calories and protein only, as the boards judge a day, and carbs or
 * fat only when the person named them. A figure the person has not set is not judged. Null when there is no
 * calorie target, because a day cannot be planned to nothing.
 */
export const planTargetOf = (
  figures: DayTargetFigures,
  named: readonly ("carbs_g" | "fat_g")[],
): FitTarget | null => {
  if (figures.kcal === null) {
    return null;
  }
  const target: FitTarget = { kcal: figures.kcal };
  if (figures.protein_g !== null) {
    target.protein_g = figures.protein_g;
  }
  for (const nutrient of named) {
    const figure = figures[nutrient];
    if (figure !== null) {
      target[nutrient] = figure;
    }
  }
  return target;
};

/**
 * The repeat limit a plan is made under, and where it came from: what the person said in this request, else
 * what they chose in their profile, else the starting limit. A request of 0 and a profile of 0 are no limit
 * (a null `maxRepeats`). Throws a `RangeError` for a value outside 0 to 7.
 */
export const resolveRepeatLimit = (
  requested: number | null,
  profileLimit: number | null,
): { maxRepeats: number | null; source: RepeatLimitSource } => {
  if (requested !== null) {
    return { maxRepeats: repeatLimitOfProfile(requested), source: "request" };
  }
  return {
    maxRepeats: repeatLimitOfProfile(profileLimit),
    source: profileLimit === null ? "default" : "profile",
  };
};
