import { buildRecipeLogEntry } from "@keylow/core/diary";

import { RECIPE_ID, recipeSummaryRow } from "./recipes";

import type { BuildRecipeLogEntryInput } from "@keylow/core/diary";

/** The recipe the entry tests log: a four serving recipe with no yield, so its cooked weight is its raw weight. */
export const loggableRecipe = recipeSummaryRow();

export const RECIPE_DAY = "2026-10-15";

/** One serving of the recipe at noon on `RECIPE_DAY`. */
export const servingInput: BuildRecipeLogEntryInput = {
  recipe: loggableRecipe,
  quantity: 1,
  unit: "serving",
  loggedAt: `${RECIPE_DAY}T12:00:00.000Z`,
  localDate: RECIPE_DAY,
};

/** A recipe entry as PostgREST returns it for the columns the repo selects, built the way a stored entry is. */
export const recipeEntryRow = (input: BuildRecipeLogEntryInput = servingInput) => {
  const entry = buildRecipeLogEntry(input);
  return {
    ...entry,
    id: "77777777-7777-4777-8777-777777777777",
    created_at: "2026-10-15T12:00:01.123456+00:00",
    kcal: entry.nutrients.kcal ?? null,
  };
};

export { RECIPE_ID };
