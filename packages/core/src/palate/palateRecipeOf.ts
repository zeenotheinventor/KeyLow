import type { PalateRecipe } from "./types";

/**
 * What the palate reads of a recipe: its id and name and the weight of one serving, so the median grams
 * of its entries can be said as servings. A recipe with no weight, or no servings, has none.
 */
export function palateRecipeOf(recipe: {
  id: string;
  name: string;
  servings: number;
  yield_grams: number | null;
}): PalateRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    servingGrams:
      recipe.yield_grams === null || recipe.servings <= 0
        ? null
        : recipe.yield_grams / recipe.servings,
  };
}
