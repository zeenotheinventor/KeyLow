import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { putRecipeInCache, refreshRecipes } from "../recipeCache";
import { useSingleFlight } from "./useSingleFlight";
import { createRecipe } from "../repos/recipeWrites";

import type { RecipeSave } from "../repos/recipeWrites";

/**
 * Creates a recipe and resolves to it as stored (see `RecipeSave`). The recipe, its ingredients, its
 * steps and its totals are written by one call to the database, or none are. The totals are computed
 * from the ingredients by the repo, so a caller passes none. A recipe the database would refuse
 * throws a `RangeError` before any request. Needs a connection: there is no offline queue.
 *
 * The hook is not re-entrant: a second press of Save with the same input while the
 * first is pending joins it and resolves to the same recipe, so it never makes a second recipe. A
 * different input is a different edit and runs after the pending save settles. The stored recipe is put in the
 * cache under its detail key, and the recipes queries are refreshed after, also after a failure.
 * Nothing in the diary is touched.
 */
export function useCreateRecipe() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const saveOnce = useSingleFlight((save: RecipeSave) => createRecipe(client, save));

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
