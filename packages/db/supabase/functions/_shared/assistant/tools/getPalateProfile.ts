// What the person usually eats and avoids, for the kitchen tools (ADR 0006, Amendment 5). Row level security
// shows a caller their own rows only, so the stats, the preferences and the names it reads are theirs. Every
// word and number of the profile is core's (`buildPalateProfile`), and this tool only reads the rows, hands
// them over and projects what the model needs: names, frequency words and the avoid list. A recipe carries its
// id because `adjust_recipe` takes one, and nothing else carries an id.
import { z } from "zod";

import { buildPalateProfile, summaryLines } from "../../core.ts";
import {
  getPalateLoggedDays,
  listPalateFoods,
  listPalatePreferences,
  listPalateStats,
  listRecipes,
} from "../../repos.ts";
import { dataNotice } from "./shared.ts";

import type { PalateRecipe } from "../../core.ts";
import type { ReadToolDefinition } from "../tool.ts";

const getPalateProfileInput = z.strictObject({});

// The weight of one serving, so core can say a recipe's usual amount in servings. A recipe with no weight
// has none.
const servingGramsOf = (recipe: { servings: number; yield_grams: number | null }): number | null =>
  recipe.yield_grams === null || recipe.servings <= 0 ? null : recipe.yield_grams / recipe.servings;

export const getPalateProfileTool: ReadToolDefinition<z.infer<typeof getPalateProfileInput>> = {
  name: "get_palate_profile",
  description:
    "Reads what the person usually eats, from their own diary of the last 90 days, and what they said " +
    "they avoid. It holds usual_foods and usual_recipes by name with how_often (most days, most weeks " +
    "or less often) and the typical amount, by_time_of_day for morning, midday and evening, " +
    "rarely_or_never food groups, avoid (allergies and dislikes, each with its kind) and summary " +
    "lines. When enough_data is false the diary is too short to say what is usual and only avoid is " +
    "filled. Call it for what the person usually eats and before a recipe or a meal plan, and never " +
    `state a figure that is not in the result. Allergies are matched by food name only. ${dataNotice}`,
  kind: "read",
  group: "kitchen",
  input: getPalateProfileInput,
  annotations: { readOnlyHint: true },
  strict: false,
  async run(ctx) {
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

    const profile = buildPalateProfile(stats, preferences, {
      today: ctx.turn.localDate,
      loggedDays,
      foods,
      recipes: palateRecipes,
    });

    return {
      data: {
        enough_data: profile.hasEnoughToGoOn,
        logged_days: profile.loggedDays,
        summary: summaryLines(profile),
        usual_foods: profile.usualFoods.map(({ name, frequency, typicalGrams }) => ({
          name,
          how_often: frequency,
          typical_grams: typicalGrams,
        })),
        usual_recipes: profile.usualRecipes.map(({ recipeId, name, typicalServings }) => ({
          recipe_id: recipeId,
          name,
          typical_servings: typicalServings,
        })),
        by_time_of_day: {
          morning: profile.byTimeOfDay.morning.map(({ name }) => name),
          midday: profile.byTimeOfDay.midday.map(({ name }) => name),
          evening: profile.byTimeOfDay.evening.map(({ name }) => name),
        },
        rarely_or_never: profile.rarelyOrNever.map(({ group }) => group),
        avoid: profile.avoid.map(({ label, kind }) => ({ label, kind })),
      },
    };
  },
};
