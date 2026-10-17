import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { refreshRecipes } from "../recipeCache";
import { setRecipeArchived } from "../repos/recipeWrites";

import type { RecipeDetail } from "../repos/recipes";

/**
 * The mutation scope of archiving. Mutations of one scope run one after another, so an Undo tapped
 * while the archive is still on its way waits for it instead of racing it, and the last tap wins.
 */
const RECIPE_ARCHIVE_SCOPE = { id: "recipe-archive" } as const;

/**
 * Archives a recipe, or brings it back with `archived: false`, and resolves to it as stored. Archiving
 * is a plain update of one flag, and the ingredients and steps are untouched. The Undo of an archive
 * is this hook again with the same id and `archived: false`. If the recipe is cached on its own, its
 * flag is set there, and the recipes queries are refreshed after, also after a failure. Nothing in
 * the diary is touched: an entry logged from the recipe keeps its frozen name and figures.
 */
export function useArchiveRecipe() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: RECIPE_ARCHIVE_SCOPE,
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setRecipeArchived(client, id, archived),
    onSuccess: ({ id, is_archived }) => {
      // A recipe that is not cached stays uncached, and a cached "not found" stays so.
      queryClient.setQueryData<RecipeDetail | null>(keys.recipes.detail(id), (cached) =>
        cached ? { ...cached, is_archived } : cached,
      );
    },
    onSettled: () => {
      refreshRecipes(queryClient);
    },
  });
}
