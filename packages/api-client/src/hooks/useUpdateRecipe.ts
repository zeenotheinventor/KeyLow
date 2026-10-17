import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { putRecipeInCache, refreshRecipes } from "../recipeCache";
import { useSingleFlight } from "./useSingleFlight";
import { updateRecipe } from "../repos/recipeWrites";

import type { RecipeUpdate } from "../repos/recipeWrites";

/**
 * Replaces the name, servings, yield, ingredients and steps of a recipe, and its totals, and resolves
 * to it as stored (see `RecipeUpdate`). It is one call to the database, so all of it is written or
 * none of it. The totals are computed from the ingredients by the repo. A recipe the database would
 * refuse throws a `RangeError` before any request. Needs a connection: there is no offline queue.
 *
 * Two devices saving one recipe at once: the last save wins, with no check for a change since the
 * recipe was read, as for custom foods. Do not add optimistic concurrency here.
 *
 * The hook is not re-entrant: a second press of Save while the first is pending joins it and resolves
 * to the same recipe. The stored recipe replaces the cached one, and the recipes queries are
 * refreshed after, also after a failure. Nothing in the diary is touched, so an entry logged from this
 * recipe keeps its frozen figures.
 */
export function useUpdateRecipe() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const saveOnce = useSingleFlight((update: RecipeUpdate) => updateRecipe(client, update));

  return useMutation({
    mutationFn: saveOnce,
    onSuccess: (recipe) => {
      putRecipeInCache(queryClient, recipe);
    },
    onSettled: () => {
      refreshRecipes(queryClient);
    },
  });
}
