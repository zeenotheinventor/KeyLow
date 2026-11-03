import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { addFavouriteRecipe, removeFavouriteRecipe } from "../repos/favourites";

import type { FavouriteRecipe } from "../repos/favourites";
import type { RecipeSummary } from "../repos/recipes";

/** Mutations of one scope run one after another, so quick taps on a star reach the database in order. */
const FAVOURITE_TOGGLE_SCOPE = { id: "recipe-favourite-toggle" } as const;

const FAVOURITE_TOGGLE_KEY = ["recipe-favourite-toggle"] as const;

const newestFirst = (first: FavouriteRecipe, second: FavouriteRecipe) =>
  second.createdAt.localeCompare(first.createdAt);

/**
 * Favourites a recipe, or with `favourite: false` unfavourites it. The cached favourites list changes
 * at once (a new favourite goes first). Every call runs its `onMutate` straight away, even while an
 * earlier call is still waiting its turn, so a failed call undoes only its own recipe and never
 * restores a snapshot, which would wipe the change of a later tap. The list is read again once the
 * last call in flight settles, and so is the favourite foods list, because the cap of 30 is shared
 * between the two. A list that is not cached stays uncached. Favouriting past the cap fails with a
 * `FavouriteRuleError` with the rule `favourite_limit`.
 */
export function useToggleFavouriteRecipe() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: FAVOURITE_TOGGLE_KEY,
    scope: FAVOURITE_TOGGLE_SCOPE,
    mutationFn: ({ recipe, favourite }: { recipe: RecipeSummary; favourite: boolean }) =>
      favourite ? addFavouriteRecipe(client, recipe.id) : removeFavouriteRecipe(client, recipe.id),
    onMutate: async ({ recipe, favourite }) => {
      // A read already on its way would overwrite the optimistic change.
      await queryClient.cancelQueries({ queryKey: keys.recipes.favourites });
      const removed = queryClient
        .getQueryData<FavouriteRecipe[]>(keys.recipes.favourites)
        ?.find((entry) => entry.recipeId === recipe.id);

      queryClient.setQueryData<FavouriteRecipe[]>(keys.recipes.favourites, (cached) => {
        if (cached === undefined) {
          return cached;
        }
        const others = cached.filter((entry) => entry.recipeId !== recipe.id);
        return favourite
          ? [{ recipeId: recipe.id, createdAt: new Date().toISOString(), recipe }, ...others]
          : others;
      });

      return { removed };
    },
    onError: (_error, { recipe, favourite }, context) => {
      queryClient.setQueryData<FavouriteRecipe[]>(keys.recipes.favourites, (cached) => {
        if (cached === undefined) {
          return cached;
        }
        const others = cached.filter((entry) => entry.recipeId !== recipe.id);
        return favourite || context?.removed === undefined
          ? others
          : [...others, context.removed].sort(newestFirst);
      });
    },
    onSettled: () => {
      // This call still counts as mutating here, so 1 means no other call is left in flight.
      if (queryClient.isMutating({ mutationKey: FAVOURITE_TOGGLE_KEY }) === 1) {
        return Promise.all([
          queryClient.invalidateQueries({ queryKey: keys.recipes.favourites }),
          queryClient.invalidateQueries({ queryKey: keys.foods.favourites }),
        ]);
      }
      return undefined;
    },
  });
}
