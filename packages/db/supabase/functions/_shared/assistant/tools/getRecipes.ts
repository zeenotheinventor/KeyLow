// The user's own recipes, for "log my chilli". Row level security shows a user their recipes only, and
// the tool reads the nutrition the recipe stored when it was saved, so it never works anything out.
import { z } from "zod";

import { listRecipes, searchRecipes } from "../../repos.ts";
import { dataNotice, resultLimitSchema, searchTextSchema, unknownNotice } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getRecipesInput = z.strictObject({
  q: searchTextSchema.nullable().describe("Part of a recipe name, or null for all recipes."),
  limit: resultLimitSchema,
});

export const getRecipesTool: ReadToolDefinition<z.infer<typeof getRecipesInput>> = {
  name: "get_recipes",
  description:
    "Lists the user's own recipes that are not archived, by name. Each has its id, name, the number " +
    "of servings, and the kcal, protein, fat, carbs and fibre of one serving. The list holds at most " +
    "limit recipes, so use q to find a specific recipe by part of its name, or pass null to list " +
    `them all. ${unknownNotice} ${dataNotice}`,
  kind: "read",
  input: getRecipesInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { q, limit }) {
    const recipes =
      q === null
        ? (await listRecipes(ctx.caller)).slice(0, limit)
        : await searchRecipes(ctx.caller, q, { limit });
    return {
      data: {
        recipes: recipes.map(({ id, name, servings, computed: { perServing, servingsOnly } }) => ({
          id,
          name,
          servings,
          servings_only: servingsOnly,
          per_serving: {
            kcal: perServing.kcal,
            protein_g: perServing.protein_g,
            fat_g: perServing.fat_g,
            carbs_g: perServing.carbs_g,
            fibre_g: perServing.fibre_g,
          },
        })),
      },
    };
  },
};
