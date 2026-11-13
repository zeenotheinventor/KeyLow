// The person's palate profile and their avoid list, read under the caller's JWT for the kitchen tools. Every word
// and number of the profile is core's (`buildPalateProfile`). This only reads the rows and hands them over.
import { buildPalateProfile } from "../../core.ts";
import {
  getPalateLoggedDays,
  listPalateFoods,
  listPalatePreferences,
  listPalateStats,
  listRecipes,
} from "../../repos.ts";

import type { PalateProfile, PalateRecipe } from "../../core.ts";
import type { ToolContext } from "../tool.ts";

// The weight of one serving, so core can say a recipe's usual amount in servings. A recipe with no weight
// has none.
const servingGramsOf = (recipe: { servings: number; yield_grams: number | null }): number | null =>
  recipe.yield_grams === null || recipe.servings <= 0 ? null : recipe.yield_grams / recipe.servings;

export type PalateRead = {
  profile: PalateProfile;
  /** The rows behind `profile.avoid`, which `avoidsFood` matches a food against by id and by name. */
  preferences: Awaited<ReturnType<typeof listPalatePreferences>>;
};

export async function readPalate(ctx: ToolContext): Promise<PalateRead> {
  const [stats, loggedDays, preferences, recipes] = await Promise.all([
    listPalateStats(ctx.caller),
    getPalateLoggedDays(ctx.caller),
    listPalatePreferences(ctx.caller),
    // Archived recipes too, because an old entry may still point at one.
    listRecipes(ctx.caller, { archived: true }),
  ]);
  const foodIds = [...new Set(stats.flatMap(({ foodId }) => (foodId === null ? [] : [foodId])))];
  const foods = await listPalateFoods(ctx.caller, foodIds);
  const palateRecipes = recipes.map((recipe): PalateRecipe => ({
    id: recipe.id,
    name: recipe.name,
    servingGrams: servingGramsOf(recipe),
  }));

  return {
    preferences,
    profile: buildPalateProfile(stats, preferences, {
      today: ctx.turn.localDate,
      loggedDays,
      foods,
      recipes: palateRecipes,
    }),
  };
}
