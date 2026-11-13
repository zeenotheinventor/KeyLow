// A stored plan made by hand for the meal plan graders: core's planner over the fixture recipes and foods, written the way
// `listMealPlans` returns a plan, and the answer `plan_meals` gives the model for it. A wrong play is this plan with one
// thing changed. No model, no database, no stack.
import { planMeals } from "@keylow/core/plans";

import { FIXTURE_FOODS } from "../fixtures/diary.ts";
import { FIXTURE_FOOD_VALUES } from "../fixtures/diaryTotals.ts";
import {
  allKitchenRecipes,
  kitchenWeek,
  planFoodCandidates,
  planRecipeCandidates,
  proteinRanking,
} from "../fixtures/kitchenFacts.ts";
import { present } from "../fixtures/present.ts";

import type { ToolCall } from "../src/types.ts";
import type { MealPlan, MealPlanDay, MealPlanItem } from "@keylow/api-client";
import type { PlannedWeek } from "@keylow/core/plans";

export const MONDAY = "2026-11-16";

/** The week from `firstLocalDate` as core plans it from the fixture recipes and foods, under the limit. */
export const plannedWeek = (
  firstLocalDate: string,
  maxRepeats: number | null,
  dayCount = 7,
): PlannedWeek =>
  planMeals({
    recipes: planRecipeCandidates(),
    foods: planFoodCandidates(),
    ranking: proteinRanking(),
    rules: { maxRepeats, leftovers: true, slots: ["morning", "midday", "evening"] },
    days: kitchenWeek(firstLocalDate).slice(0, dayCount),
  });

const itemIdOf = (key: string): string => `item:${key}`;

const nameOfFood = (id: string): string =>
  FIXTURE_FOOD_VALUES[
    present(
      FIXTURE_FOODS.find((key) => key === id),
      id,
    )
  ].name;

const figures = (nutrients: PlannedWeek["days"][number]["items"][number]["nutrients"]) => ({
  kcal: nutrients.kcal,
  protein_g: nutrients.protein_g,
  carbs_g: nutrients.carbs_g,
  fat_g: nutrients.fat_g,
  fibre_g: nutrients.fibre_g,
});

/** The plan as the database holds it: ids for the days and items, a leftover pointing at its cook's item id. */
export function storedPlanOf(
  plan: PlannedWeek,
  { id = "plan-1", maxRepeats = 2 }: { id?: string; maxRepeats?: number | null } = {},
): MealPlan {
  const days = plan.days.map((day): MealPlanDay => ({
    id: `day:${day.localDate}`,
    localDate: day.localDate,
    target: { kcal: day.target.kcal ?? null, protein_g: day.target.protein_g ?? null },
    confirmedAt: null,
    confirmedEntryIds: null,
    items: day.items.map((item, position): MealPlanItem => {
      const shared = {
        id: itemIdOf(item.key),
        position,
        slotTime: `${item.time}:00`,
        nutrients: figures(item.nutrients),
        leftoverOf: item.leftoverOf === null ? null : itemIdOf(item.leftoverOf),
      };
      return item.kind === "recipe"
        ? {
            ...shared,
            kind: "recipe",
            recipeId: item.recipeId,
            servings: 1,
            snapshot: { name: item.recipeId, servings: 1, effectiveGrams: 300 },
          }
        : {
            ...shared,
            kind: "food",
            foodId: item.foodId,
            grams: item.grams,
            portionId: null,
            snapshot: { name: nameOfFood(item.foodId) },
          };
    }),
  }));
  const first = days[0];
  return {
    id,
    startDate: first?.localDate ?? MONDAY,
    dayCount: days.length,
    rules: { maxRepeats, leftovers: true, slots: ["morning", "midday", "evening"], ranking: [] },
    source: "assistant",
    archivedAt: null,
    createdAt: "2026-11-13T10:00:00Z",
    days,
  };
}

/** What `plan_meals` answers the model for the plan: each day's status and what it is short of, and the limit. */
export function planMealsResult(
  plan: PlannedWeek,
  limit: { max_repeats: number | null; chosen_by: "default" | "request" },
): Record<string, unknown> {
  return {
    planned: true,
    repeat_limit: limit,
    days: plan.days.map((day) => ({
      local_date: day.localDate,
      status: day.status,
      short_of: day.shortfalls.map(({ nutrient }) => ({ nutrient, not_fully_worked_out: false })),
    })),
  };
}

export const planMealsCall = (
  plan: PlannedWeek,
  limit: { max_repeats: number | null; chosen_by: "default" | "request" },
  input: Record<string, unknown> = {},
): ToolCall => ({
  name: "plan_meals",
  input: { start_date: null, days: plan.days.length, max_repeats: null, ...input },
  readOnlyHint: false,
  result: planMealsResult(plan, limit),
});

/** The recipe names of the kitchen world, so a test can pick a recipe to repeat. */
export const recipeNames = allKitchenRecipes.map(({ name }) => name);

/** A copy of the plan with one change to a day, for a wrong play. */
export const withDay = (
  plan: MealPlan,
  index: number,
  change: (day: MealPlanDay) => MealPlanDay,
): MealPlan => ({
  ...plan,
  days: plan.days.map((day, at) => (at === index ? change(day) : day)),
});
