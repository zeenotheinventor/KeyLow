import { RecentFoods } from "../RecentFoods";
import { SearchResults } from "../SearchResults";

import type { IngredientSearchResultsProps } from "./types";

/**
 * The search sheet's results while an ingredient is being found for a recipe. Every row opens the amount step,
 * because the amount matters in a recipe: a chevron in place of the log search's plus. The idle state is
 * Recent alone, with no Quick add, and a Recent row opens the amount step with the amount it was last logged
 * with. Recipes are not offered, because a recipe cannot be an ingredient, and with nothing found there is no
 * Create a food, because the form would take the person away from the recipe.
 */
export function IngredientSearchResults({
  query,
  onOpenFood,
  onOpenRecent,
}: IngredientSearchResultsProps) {
  return (
    <SearchResults
      choosesAmount
      idleContent={<RecentFoods onOpen={onOpenRecent} />}
      query={query}
      onOpenFood={onOpenFood}
    />
  );
}
