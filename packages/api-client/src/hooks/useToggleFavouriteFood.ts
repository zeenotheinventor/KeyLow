import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { addFavouriteFood, removeFavouriteFood } from "../repos/favourites";

import type { FavouriteFood } from "../repos/favourites";
import type { Food } from "@keylow/core/schemas";

/** Mutations of one scope run one after another, so quick taps on a star reach the database in order. */
const FAVOURITE_TOGGLE_SCOPE = { id: "food-favourite-toggle" } as const;

const FAVOURITE_TOGGLE_KEY = ["food-favourite-toggle"] as const;

const newestFirst = (first: FavouriteFood, second: FavouriteFood) =>
  second.createdAt.localeCompare(first.createdAt);

/**
 * Favourites a food, or with `favourite: false` unfavourites it. The cached favourites list changes
 * at once (a new favourite goes first). Every call runs its `onMutate` straight away, even while an
 * earlier call is still waiting its turn, so a failed call undoes only its own food and never
 * restores a snapshot, which would wipe the change of a later tap. The list is read again once the
 * last call in flight settles. A list that is not cached stays uncached. Favouriting a 31st food
 * fails with a `FavouriteRuleError` with the rule `favourite_limit`.
 */
export function useToggleFavouriteFood() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: FAVOURITE_TOGGLE_KEY,
    scope: FAVOURITE_TOGGLE_SCOPE,
    mutationFn: ({ food, favourite }: { food: Food; favourite: boolean }) =>
      favourite ? addFavouriteFood(client, food.id) : removeFavouriteFood(client, food.id),
    onMutate: async ({ food, favourite }) => {
      // A read already on its way would overwrite the optimistic change.
      await queryClient.cancelQueries({ queryKey: keys.foods.favourites });
      const removed = queryClient
        .getQueryData<FavouriteFood[]>(keys.foods.favourites)
        ?.find((entry) => entry.foodId === food.id);

      queryClient.setQueryData<FavouriteFood[]>(keys.foods.favourites, (cached) => {
        if (cached === undefined) {
          return cached;
        }
        const others = cached.filter((entry) => entry.foodId !== food.id);
        return favourite
          ? [{ foodId: food.id, createdAt: new Date().toISOString(), food }, ...others]
          : others;
      });

      return { removed };
    },
    onError: (_error, { food, favourite }, context) => {
      queryClient.setQueryData<FavouriteFood[]>(keys.foods.favourites, (cached) => {
        if (cached === undefined) {
          return cached;
        }
        const others = cached.filter((entry) => entry.foodId !== food.id);
        return favourite || context?.removed === undefined
          ? others
          : [...others, context.removed].sort(newestFirst);
      });
    },
    onSettled: () => {
      // This call still counts as mutating here, so 1 means no other call is left in flight.
      if (queryClient.isMutating({ mutationKey: FAVOURITE_TOGGLE_KEY }) === 1) {
        return queryClient.invalidateQueries({ queryKey: keys.foods.favourites });
      }
      return undefined;
    },
  });
}
