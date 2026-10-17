import { useRecipeSearch } from "@keylow/api-client";
import { previewRecipeAmount, recipeAmountStart } from "@keylow/core/diary";

import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { LogIdle } from "../LogIdle";
import { SearchResults } from "../SearchResults";
import { useAddServing } from "../useAddServing";

import type { LogSearchResultsProps } from "./types";
import type { RecipeSummary } from "@keylow/api-client";

// A recipe is offered only when one serving can be logged and its row can show every figure. One with no
// weight cannot be logged (one serving of nothing is nothing). One missing a value would say "Needs review"
// with no plus, and its row opens nothing yet, so it would be a dead end.
function canBeLoggedFromTheSearch(recipe: RecipeSummary): boolean {
  const { kcal, protein_g, carbs_g, fat_g } = recipe.computed.perServing;

  return (
    previewRecipeAmount(recipe, recipeAmountStart()) !== null &&
    kcal !== null &&
    protein_g !== null &&
    carbs_g !== null &&
    fat_g !== null
  );
}

/**
 * The search sheet's results while food is being logged: the idle state is Quick add and Recent, and each
 * row shows a serving with a plus that logs it at once, and the user's recipes that match come first. Only
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
          rows:
            recipeSearch.error === null
              ? recipeSearch.recipes.filter(canBeLoggedFromTheSearch)
              : [],
          isSearching: recipeSearch.isDebouncing || recipeSearch.isLoading,
          onAdd: addRecipe,
        },
      }}
      query={query}
      onCreateFood={onCreateFood}
      onOpenFood={onOpenFood}
    />
  );
}
