import { recipeEntryFields } from "./recipeEntryFields";
import { freezeRecipe, withRecipeQuantity } from "./recipeSnapshotQuantity";

import type { LoggableRecipe, RecipeAmount } from "./recipeSnapshotQuantity";
import type { RecipeLogEntryInsert } from "./schemas";

export type BuildRecipeLogEntryInput = RecipeAmount & {
  recipe: LoggableRecipe;
  /** The instant the entry was logged, as an ISO 8601 timestamp with an offset. */
  loggedAt: string;
  /** The calendar day the entry belongs to, `YYYY-MM-DD`, in the profile's time zone. Stored as given. */
  localDate: string;
};

/**
 * Builds a recipe entry ready to insert (ADR 0003, Amendment 8): the recipe frozen from its `computed`
 * cache, the amount resolved to grams of cooked weight, and the nutrients scaled from the snapshot alone.
 * By serving the quantity is a number of servings, by grams it is grams of cooked weight.
 *
 * Throws a `RangeError` for a negative quantity, a unit that is not `serving` or `g`, a recipe whose
 * servings or cooked weight is not above 0, and an amount too large to work out. The messages never
 * quote a value.
 */
export const buildRecipeLogEntry = (input: BuildRecipeLogEntryInput): RecipeLogEntryInsert => {
  const snapshot = withRecipeQuantity(freezeRecipe(input.recipe), input);
  return {
    local_date: input.localDate,
    logged_at: input.loggedAt,
    ...recipeEntryFields(snapshot),
  };
};
