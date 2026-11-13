import { planMeals } from "./planMeals";
import { planTargetOf } from "./planRequest";

import type { DayTargetFigures } from "./planRequest";
import type { Plan, PlanDayInput, PlanMealsInput, PlannedWeek } from "./types";

/** Whether no day of the plan has anything planned on it. */
export const planHasNoItems = (plan: Plan): boolean =>
  plan.days.every(({ items }) => items.length === 0);

/**
 * The weight of one serving of a recipe, from its cooked weight, or null when the recipe has no weight (a recipe
 * that is servings only, or one with no servings). The card and the tool both say a serving's weight this way.
 */
export const planServingGrams = (recipe: {
  servings: number;
  effectiveGrams: number;
}): number | null =>
  recipe.servings > 0 && recipe.effectiveGrams > 0 ? recipe.effectiveGrams / recipe.servings : null;

/**
 * The days of a plan, each with the target the planner judges it by, or null when a day has no calorie target.
 * `figuresOf` gives the person's figures for a date.
 */
export const planDaysOf = (
  dates: readonly string[],
  figuresOf: (localDate: string) => DayTargetFigures,
  named: readonly ("carbs_g" | "fat_g")[],
): PlanDayInput[] | null => {
  const days: PlanDayInput[] = [];
  for (const localDate of dates) {
    const target = planTargetOf(figuresOf(localDate), named);
    if (target === null) {
      return null;
    }
    days.push({ localDate, target });
  }
  return days;
};

/**
 * Plans the days. When the person gave wishes and the model ranked something, only the ranked items are
 * planned, because the model left out what clashes with the wishes. If that places nothing at all, the whole
 * pool is planned instead and `wishesKept` is false, so the person is told.
 */
export const planWeek = (
  input: PlanMealsInput & { hasWishes: boolean },
): { plan: PlannedWeek; wishesKept: boolean } => {
  const { hasWishes, ...pool } = input;
  if (hasWishes && pool.ranking.length > 0) {
    const ranked = new Set(pool.ranking);
    const focused = planMeals({
      ...pool,
      recipes: pool.recipes.filter(({ id }) => ranked.has(id)),
      foods: pool.foods.filter(({ id }) => ranked.has(id)),
    });
    if (!planHasNoItems(focused)) {
      return { plan: focused, wishesKept: true };
    }
    return { plan: planMeals(pool), wishesKept: false };
  }
  return { plan: planMeals(pool), wishesKept: true };
};
