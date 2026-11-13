// What `plan_meals` and `replan_day` share: what the person's kitchen offers to plan from, the live plans as core
// picks days from them, and a day's figures as the model reads them. Nothing here logs or reports a food, a recipe or
// a plan.
import { buildPalateProfile, buildPlanPool, roundCalories, roundGrams } from "../../core.ts";
import {
  getFood,
  getPalateLoggedDays,
  listMealPlans,
  listPalateFoods,
  listPalatePreferences,
  listPalateStats,
  listRecipes,
} from "../../repos.ts";

import type { LivePlan, PalateRecipe, Plan } from "../../core.ts";
import type { ToolContext } from "../tool.ts";

// What the person's diary and recipes offer to plan from, read under their JWT.
export async function readKitchen(ctx: ToolContext) {
  const [stats, loggedDays, preferences, recipes] = await Promise.all([
    listPalateStats(ctx.caller),
    getPalateLoggedDays(ctx.caller),
    listPalatePreferences(ctx.caller),
    listRecipes(ctx.caller),
  ]);
  const foodIds = [...new Set(stats.flatMap(({ foodId }) => (foodId === null ? [] : [foodId])))];
  const palateFoods = await listPalateFoods(ctx.caller, foodIds);
  const palateRecipes = recipes.map((recipe): PalateRecipe => ({
    id: recipe.id,
    name: recipe.name,
    servingGrams:
      recipe.yield_grams === null || recipe.servings <= 0
        ? null
        : recipe.yield_grams / recipe.servings,
  }));
  const profile = buildPalateProfile(stats, preferences, {
    today: ctx.turn.localDate,
    loggedDays,
    foods: palateFoods,
    recipes: palateRecipes,
  });
  const usualFoods = await Promise.all(
    profile.usualFoods.map(async ({ foodId, typicalGrams }) => ({
      foodId,
      typicalGrams,
      food: await getFood(ctx.caller, foodId),
    })),
  );
  const foods = usualFoods.flatMap(({ food }) => (food === null ? [] : [food]));
  return { stats, preferences, recipes, profile, usualFoods, foods };
}

export const caloriesAndProtein = (day: Plan["days"][number]) => ({
  local_date: day.localDate,
  status: day.status,
  kcal: day.totals.kcal === null ? null : roundCalories(day.totals.kcal),
  protein_g: day.totals.protein_g === null ? null : roundGrams(day.totals.protein_g),
  target_kcal: day.target.kcal ?? null,
  target_protein_g: day.target.protein_g ?? null,
  short_of: day.shortfalls.map(({ nutrient, reason }) => ({
    nutrient,
    // A work limit means the planner stopped before it knew the day was out of reach.
    not_fully_worked_out: reason === "work_limit",
  })),
});

// The live plans as core picks days from them, and as the cleanup reads what to put back.
export const livePlansOf = (plans: Awaited<ReturnType<typeof listMealPlans>>): LivePlan[] =>
  plans.map(({ id, days }) => ({
    id,
    days: days.map((day) => ({
      id: day.id,
      localDate: day.localDate,
      isConfirmed: day.confirmedAt !== null,
      itemCount: day.items.length,
    })),
  }));

// What core plans from: the person's recipes and usual foods, with what they avoid left out by name.
export const planPoolOf = (kitchen: Awaited<ReturnType<typeof readKitchen>>) =>
  buildPlanPool({
    recipes: kitchen.recipes,
    usualRecipeIds: kitchen.profile.usualRecipes.map(({ recipeId }) => recipeId),
    usualFoods: kitchen.usualFoods,
    foods: kitchen.foods,
    stats: kitchen.stats,
    preferences: kitchen.preferences,
  });
