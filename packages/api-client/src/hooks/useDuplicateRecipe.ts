import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { putRecipeInCache, refreshRecipes } from "../recipeCache";
import { useSingleFlight } from "./useSingleFlight";
import { duplicateRecipe } from "../repos/recipeWrites";

import type { DuplicateRecipeInput } from "../repos/recipeWrites";

/**
 * Saves a copy of a recipe under the name the caller chose (the wording of "copy" is screen copy)
 * and resolves to the copy as stored. The copy keeps the ingredient rows as they are stored: frozen
 * values stay frozen, and only "Refresh ingredients" moves a recipe onto current food data. The
 * original is not touched. Needs a connection: there is no offline queue.
 *
 * The hook is not re-entrant: a second press while the first is pending joins it and resolves to the
 * same copy, so it never makes two. The copy is put in the cache under its own detail key, and the
 * recipes queries are refreshed after, also after a failure. Nothing in the diary is touched.
 */
export function useDuplicateRecipe() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const duplicateOnce = useSingleFlight((input: DuplicateRecipeInput) =>
    duplicateRecipe(client, input),
  );

  return useMutation({
    mutationFn: duplicateOnce,
    onSuccess: (copy) => {
      putRecipeInCache(queryClient, copy);
    },
    onSettled: () => {
      refreshRecipes(queryClient);
    },
  });
}
