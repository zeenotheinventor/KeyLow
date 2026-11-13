// What the person usually eats and avoids, for the kitchen tools (ADR 0006, Amendment 5). Row level security
// shows a caller their own rows only, so the stats, the preferences and the names it reads are theirs. Every
// word and number of the profile is core's (`buildPalateProfile`), and this tool only reads the rows, hands
// them over and projects what the model needs: names, frequency words and the avoid list. A recipe carries its
// id because `adjust_recipe` takes one, and nothing else carries an id.
import { z } from "zod";

import { summaryLines } from "../../core.ts";
import { readPalate } from "./readPalate.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getPalateProfileInput = z.strictObject({});

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
    const { profile } = await readPalate(ctx);

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
