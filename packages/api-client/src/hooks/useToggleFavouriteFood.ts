import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { addFavouriteFood, removeFavouriteFood } from "../repos/favourites";

import type { FavouriteFood } from "../repos/favourites";
import type { Food } from "@keylow/core/schemas";

/** Mutations of one scope run one after another, so quick taps on a star reach the database in order. */
const FAVOURITE_TOGGLE_SCOPE = { id: "food-favourite-toggle" } as const;

/**
 * Favourites a food, or with `favourite: false` unfavourites it. The cached favourites list changes
 * at once (a new favourite goes first) and is put back if the request fails, and the list is read
 * again after the request either way. A list that is not cached stays uncached. Favouriting a
 * 31st food fails with a `FavouriteRuleError` with the rule `favourite_limit`.
 */
export function useToggleFavouriteFood() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: FAVOURITE_TOGGLE_SCOPE,
    mutationFn: ({ food, favourite }: { food: Food; favourite: boolean }) =>
      favourite ? addFavouriteFood(client, food.id) : removeFavouriteFood(client, food.id),
    onMutate: async ({ food, favourite }) => {
      // A read already on its way would overwrite the optimistic change.
      await queryClient.cancelQueries({ queryKey: keys.foods.favourites });
      const previous = queryClient.getQueryData<FavouriteFood[]>(keys.foods.favourites);

      queryClient.setQueryData<FavouriteFood[]>(keys.foods.favourites, (cached) => {
        if (cached === undefined) {
          return cached;
        }
        const others = cached.filter((entry) => entry.foodId !== food.id);
        return favourite
          ? [{ foodId: food.id, createdAt: new Date().toISOString(), food }, ...others]
          : others;
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(keys.foods.favourites, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.foods.favourites }),
  });
}
