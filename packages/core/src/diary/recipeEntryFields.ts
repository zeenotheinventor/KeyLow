import { nutrientsOfRecipeSnapshot } from "./recipeSnapshotQuantity";

import type { RecipeLogEntryInsert, RecipeSnapshot } from "./schemas";

/**
 * Every column of a recipe entry that depends on the snapshot, derived from it. Building and recomputing
 * an entry both go through here, so the columns can never disagree with the snapshot.
 */
export const recipeEntryFields = (
  snapshot: RecipeSnapshot,
): Pick<
  RecipeLogEntryInsert,
  | "item_type"
  | "food_id"
  | "recipe_id"
  | "quantity"
  | "unit"
  | "portion_id"
  | "resolved_grams"
  | "snapshot"
  | "nutrients"
> => ({
  item_type: "recipe",
  food_id: null,
  recipe_id: snapshot.ref,
  quantity: snapshot.quantity,
  unit: snapshot.unit,
  portion_id: null,
  resolved_grams: snapshot.resolvedGrams,
  snapshot,
  nutrients: nutrientsOfRecipeSnapshot(snapshot),
});
