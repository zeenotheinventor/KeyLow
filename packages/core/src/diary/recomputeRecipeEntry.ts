import { recipeEntryFields } from "./recipeEntryFields";
import { withRecipeQuantity } from "./recipeSnapshotQuantity";

import type { RecipeAmount } from "./recipeSnapshotQuantity";
import type { RecipeLogEntryInsert } from "./schemas";

/**
 * Changes the quantity or the unit of a recipe entry (servings to grams of cooked weight and back) using
 * only the entry's own snapshot. The recipe is not an argument, so a live recipe that has been edited
 * since cannot leak in: the frozen servings, cooked weight and totals are reused as they were logged.
 * Everything else on the entry (timing, ids, extra columns) is kept. There is no "update to the current
 * recipe" action.
 *
 * Throws a `RangeError` for a negative quantity, a unit that is not `serving` or `g`, or a snapshot whose
 * servings or cooked weight is not above 0. The messages never quote a value.
 */
export const recomputeRecipeEntry = <Entry extends RecipeLogEntryInsert>(
  entry: Entry,
  change: RecipeAmount,
): Entry => ({ ...entry, ...recipeEntryFields(withRecipeQuantity(entry.snapshot, change)) });
