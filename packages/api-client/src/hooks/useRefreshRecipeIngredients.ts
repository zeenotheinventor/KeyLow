import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { refreshRecipes } from "../recipeCache";
import { useSingleFlight } from "./useSingleFlight";
import { applyRecipeRefresh } from "../repos/recipeWrites";

/**
 * Applies "Refresh ingredients" to a recipe, the only way a changed food reaches it, and resolves to
 * the diff it applied. The foods are read as they are at that moment, not as the preview saw them, so
 * if one changed since the preview the diff is the newer one and a screen shows what was written. The
 * new ingredients and totals are saved in one call to the database, all or nothing, and nothing is
 * saved when no food changed. Needs a connection: there is no offline queue. Do not add a check for a
 * change since the preview.
 *
 * The hook is not re-entrant: a second press for the same recipe while the first is pending joins it and
 * resolves to the same diff, so it makes one request. The recipes queries, the preview included, are
 * refreshed after, also after a failure. Nothing in the diary is touched, so an entry logged from this
 * recipe keeps its frozen figures.
 */
export function useRefreshRecipeIngredients() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const refreshOnce = useSingleFlight((recipeId: string) => applyRecipeRefresh(client, recipeId));

  return useMutation({
    mutationFn: refreshOnce,
    onSettled: () => {
      refreshRecipes(queryClient);
    },
  });
}
