import { per100gOf } from "./computeRecipe";

import type { RecipeComputed } from "./schemas";
import type { LoggableRecipe } from "../diary/recipeSnapshotQuantity";
import type { RecipeSnapshot } from "../diary/schemas";

/** A recipe made from what an entry froze: the part of a recipe row and its cache that the entry's screens read. */
export type RecipeOfSnapshot = Omit<LoggableRecipe, "computed"> & {
  computed: Pick<RecipeComputed, "total" | "effectiveGrams" | "per100g">;
};

/**
 * A recipe row made from what a recipe entry froze, so the screens that draw a recipe (its hero, its values
 * per 100 g) can draw a logged entry from its own snapshot and never from the live recipe. The values per
 * 100 g are worked out the way `computeRecipe` does, from the frozen totals and cooked weight, so they are
 * the cache the recipe had when the entry was logged. How much was logged does not reach the result.
 */
export const recipeOfSnapshot = (snapshot: RecipeSnapshot): RecipeOfSnapshot => ({
  id: snapshot.ref,
  name: snapshot.name,
  servings: snapshot.servings,
  yield_grams: snapshot.yieldGrams,
  computed: {
    total: snapshot.total,
    effectiveGrams: snapshot.effectiveGrams,
    per100g: per100gOf(snapshot.total, snapshot.effectiveGrams),
  },
});
