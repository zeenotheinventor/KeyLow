import { confirmInputsOfDay } from "@keylow/core/plans";

import { getFood } from "./foods";
import { confirmMealPlanDay } from "./mealPlans";
import { getRecipe } from "./recipes";

import type { MealPlanDay } from "./mealPlans";
import type { Database } from "../database.types";
import type { LoggableRecipe } from "@keylow/core/diary";
import type { Food } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

// A plan says what a person intends to eat, so it is health data. A failure here names the action and a code
// only, and nothing quotes a food, a recipe or an amount.

const ACTION = "confirm this day";

const notConfirmable = (code: string) =>
  new Error(`Could not ${ACTION} (${code})`, { cause: { code } });

const unique = (ids: readonly (string | null)[]): string[] => [
  ...new Set(ids.filter((id): id is string => id !== null)),
];

/**
 * Confirms a day of a plan: reads each food and recipe the day uses as it is now, lets core turn the items
 * into diary entries at their times (`confirmInputsOfDay`, so every snapshot is fresh), and writes them with
 * `confirmMealPlanDay`, which stamps the day in the same transaction. Resolves to the new entry ids.
 *
 * A day that is already confirmed is refused before any request, with the code `22023` the database gives, and
 * so is a day with nothing planned (`empty`) and one whose food or recipe is gone or deleted (`gone`).
 */
export async function confirmPlannedDay(
  client: SupabaseClient<Database>,
  day: Pick<MealPlanDay, "id" | "localDate" | "confirmedAt" | "items">,
  timeZone: string,
): Promise<string[]> {
  if (day.confirmedAt !== null) {
    throw notConfirmable("22023");
  }
  if (day.items.length === 0) {
    throw notConfirmable("empty");
  }
  const foodIds = unique(day.items.map((item) => (item.kind === "food" ? item.foodId : null)));
  const recipeIds = unique(
    day.items.map((item) => (item.kind === "recipe" ? item.recipeId : null)),
  );
  const [foodRows, recipeRows] = await Promise.all([
    Promise.all(foodIds.map((id) => getFood(client, id))),
    Promise.all(recipeIds.map((id) => getRecipe(client, id))),
  ]);

  const foods = new Map<string, Food>();
  for (const food of foodRows) {
    // A deleted food is not one a person can log, so it is as good as gone.
    if (food !== null && food.deleted_at === null) {
      foods.set(food.id, food);
    }
  }
  const recipes = new Map<string, LoggableRecipe>();
  for (const recipe of recipeRows) {
    if (recipe !== null) {
      recipes.set(recipe.id, recipe);
    }
  }

  let inputs;
  try {
    inputs = confirmInputsOfDay({
      localDate: day.localDate,
      timeZone,
      items: day.items,
      foods,
      recipes,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw notConfirmable("gone");
    }
    throw error;
  }

  return confirmMealPlanDay(client, day.id, inputs);
}
