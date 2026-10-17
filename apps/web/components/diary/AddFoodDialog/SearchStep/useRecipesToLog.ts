import { useRecipeSearch } from "@keylow/api-client";
import { canLogRecipe } from "@keylow/core/diary";

import type { RecipeSummary } from "@keylow/api-client";

/** One empty list, so a search with nothing to show does not make a new one on every render. */
export const NO_RECIPES: readonly RecipeSummary[] = [];

type RecipesToLog = {
  /** The live recipes that match and can be logged, in the library's order. */
  recipes: readonly RecipeSummary[];
  /** The query has changed and the recipes on show are not yet the answer to it. */
  isSearching: boolean;
};

/**
 * The recipes the add dialog offers for what was typed. A recipe that cannot be logged is left out, because
 * there is no row for it until the amount step can open. A failed search leaves the recipes out and says
 * nothing, so the foods are as they are without it: a feature added to the search must not take food
 * logging away.
 */
export function useRecipesToLog(query: string): RecipesToLog {
  const { recipes, isLoading, isDebouncing, error } = useRecipeSearch(query);

  return {
    recipes: error === null ? recipes.filter(canLogRecipe) : NO_RECIPES,
    isSearching: isDebouncing || isLoading,
  };
}
