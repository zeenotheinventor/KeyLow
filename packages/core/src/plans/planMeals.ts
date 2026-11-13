import { PLAN_FIT_BUDGET, buildDay, leftoverItemOf } from "./buildDay";
import { MEAL_PLAN_MAX_DAYS } from "./constants";
import { preparePool } from "./preparePool";
import { addCalendarDays, isCalendarDay } from "../dates/calendarDay";
import { FIT_NUTRIENTS } from "../recipes/fit";

import type { RecipePlanItem } from "./buildDay";
import type { RecipeChoice } from "./preparePool";
import type { PlanBand, PlanDay, PlanDayInput, PlanMealsInput, PlannedWeek } from "./types";

const validateDays = (days: readonly PlanDayInput[]): void => {
  if (days.length === 0 || days.length > MEAL_PLAN_MAX_DAYS) {
    throw new RangeError(`A plan covers from 1 to ${MEAL_PLAN_MAX_DAYS} days`);
  }
  days.forEach(({ localDate, target }, at) => {
    if (!isCalendarDay(localDate)) {
      throw new RangeError("Every day must be a calendar date written YYYY-MM-DD");
    }
    const previous = days[at - 1];
    if (previous !== undefined && addCalendarDays(previous.localDate, 1) !== localDate) {
      throw new RangeError("The days of a plan must follow one another");
    }
    for (const nutrient of FIT_NUTRIENTS) {
      const wanted = target[nutrient];
      if (wanted !== undefined && (!Number.isFinite(wanted) || wanted < 0)) {
        throw new RangeError("A target must be a finite number of at least 0");
      }
    }
  });
};

/** How many times each recipe, and each food, is placed on these days. A leftover is a placement. */
export const usageOf = (
  days: readonly PlanDay[],
): { appearances: Map<string, number>; foodUse: Map<string, number> } => {
  const appearances = new Map<string, number>();
  const foodUse = new Map<string, number>();
  for (const { kind, id } of days.flatMap((day) =>
    day.items.map((item) => ({
      kind: item.kind,
      id: item.kind === "recipe" ? item.recipeId : item.foodId,
    })),
  )) {
    const counts = kind === "recipe" ? appearances : foodUse;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return { appearances, foodUse };
};

type Reserved = { band: PlanBand; recipe: RecipeChoice; cookKey: string };

/**
 * Plans the days in order, each from the person's own recipes and foods in the order of the ranking.
 *
 * Deterministic: the same input gives the same plan. Each day is built by `buildDay`. A recipe cooked for
 * more than one serving puts the rest on the following days in the same band, when leftovers are on and
 * those bands are free, and each leftover counts toward `rules.maxRepeats` (null is no limit). The limit
 * applies to recipes. Foods are filler that the fitter scales, and may repeat on every day.
 *
 * A day that cannot land within tolerance is returned as `short` with each missed nutrient and the reason,
 * never adjusted to look met. Throws a `RangeError` for days that are not 1 to 7 consecutive dates, a target
 * that is not a number of at least 0, and rules that cannot be planned.
 */
export const planMeals = (input: PlanMealsInput): PlannedWeek => {
  validateDays(input.days);
  const pool = preparePool(input);
  const recipeById = new Map(pool.recipes.map((recipe) => [recipe.id, recipe]));

  const reserved = new Map<number, Reserved[]>();
  const appearances = new Map<string, number>();
  const foodUse = new Map<string, number>();
  const budget = { remaining: PLAN_FIT_BUDGET };
  const days: PlanDay[] = [];

  input.days.forEach((dayInput, dayAt) => {
    const leftoversToday = reserved.get(dayAt) ?? [];
    const fixed: RecipePlanItem[] = leftoversToday.map(({ band, recipe, cookKey }) =>
      leftoverItemOf(dayInput.localDate, band, recipe, cookKey),
    );
    const isBandFree = (band: PlanBand, at: number): boolean =>
      !(reserved.get(at) ?? []).some((leftover) => leftover.band === band);
    const leftoverRoom = (band: PlanBand): number => {
      let room = 0;
      while (dayAt + room + 1 < input.days.length && isBandFree(band, dayAt + room + 1)) {
        room += 1;
      }
      return room;
    };

    // A day may spend its fair share of what is left, so a hard day cannot starve the days after it.
    const share = Math.ceil(budget.remaining / (input.days.length - dayAt));
    const dayBudget = { remaining: share };
    const { day, cooks } = buildDay({
      day: dayInput,
      pool,
      appearances,
      foodUse,
      fixed,
      budget: dayBudget,
      leftoverRoom,
    });
    budget.remaining -= share - dayBudget.remaining;
    days.push(day);

    for (const { key, recipeId, band, batch } of cooks) {
      const recipe = recipeById.get(recipeId);
      if (recipe === undefined) {
        continue;
      }
      appearances.set(recipeId, (appearances.get(recipeId) ?? 0) + batch);
      for (let offset = 1; offset < batch; offset += 1) {
        const at = dayAt + offset;
        reserved.set(at, [...(reserved.get(at) ?? []), { band, recipe, cookKey: key }]);
      }
    }
    for (const item of day.items) {
      if (item.kind === "food") {
        foodUse.set(item.foodId, (foodUse.get(item.foodId) ?? 0) + 1);
      }
    }
  });

  return { days, fitCalls: PLAN_FIT_BUDGET - budget.remaining };
};
