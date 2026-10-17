import { keys } from "./queryKeys";

import type { RecipeDetail } from "./repos/recipes";
import type { QueryClient } from "@tanstack/react-query";

/** Puts a stored recipe in the cache of its own screen, so a screen that opens it next has it at once. */
export function putRecipeInCache(queryClient: QueryClient, recipe: RecipeDetail): void {
  queryClient.setQueryData(keys.recipes.detail(recipe.id), recipe);
}

/**
 * Marks the library, every recipe and every search stale after a write. Only `keys.recipes.all` is
 * touched: saving a recipe never reads, writes or refreshes a diary query, because a past entry never
 * changes when a recipe does.
 */
export function refreshRecipes(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.recipes.all });
}
