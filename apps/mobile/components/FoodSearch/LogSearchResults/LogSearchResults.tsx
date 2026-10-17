import { useRecipeSearch } from "@keylow/api-client";

import { canLogRecipe } from "../../../lib/canLogRecipe";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { LogIdle } from "../LogIdle";
import { SearchResults } from "../SearchResults";
import { useAddServing } from "../useAddServing";

import type { LogSearchResultsProps } from "./types";

/**
 * The search sheet's results while food is being logged: the idle state is Quick add and Recent, and each
 * row shows a serving with a plus that logs it at once, and the user's recipes that match come first (a
 * recipe row opens the amount step, and its plus logs one serving). Only
 * here are the toast, the log and the recipe search needed, so the plain search never asks for them.
 */
export function LogSearchResults({
  query,
  logging,
  onOpenFood,
  onCreateFood,
}: LogSearchResultsProps) {
  const { canAdd, addHit, addRecent, addRecipe } = useAddServing(logging.context);
  const recipeSearch = useRecipeSearch(query, { enabled: useReadsEnabled() });

  return (
    <SearchResults
      idleContent={
        <LogIdle
          addDisabled={!canAdd}
          onAdd={addRecent}
          onQuickAdd={logging.onQuickAdd}
          onOpen={(recent) => {
            logging.onOpenRecent(recent.foodId);
          }}
        />
      }
      logRows={{
        addDisabled: !canAdd,
        onAdd: addHit,
        recipes: {
          // A failed recipe search leaves the recipes out and the foods as they are, as a failed Open Food
          // Facts search leaves the local results: a feature added to the search must not take food logging away.
          rows: recipeSearch.error === null ? recipeSearch.recipes.filter(canLogRecipe) : [],
          isSearching: recipeSearch.isDebouncing || recipeSearch.isLoading,
          onAdd: addRecipe,
          onOpen: (recipe) => {
            logging.onOpenRecipe(recipe.id);
          },
        },
      }}
      query={query}
      onCreateFood={onCreateFood}
      onOpenFood={onOpenFood}
    />
  );
}
