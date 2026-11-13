import { useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getFood, listFoodPortions } from "../repos/foods";

import type { Food, FoodPortion } from "@keylow/core/schemas";

export type LoadedFood = { food: Food; portions: FoodPortion[] };

/**
 * A function that loads foods and their portions by id, for an action that needs them once and not as a
 * screen's state, such as opening the recipe editor on a drafted recipe. It reads through the same queries
 * as `useFood` and `useFoodPortions`, so a food already on screen is not asked for again. A food that is not
 * visible to the person is left out of the result, and a lookup that fails rejects, so the caller never
 * carries on with fewer foods than it asked for without knowing.
 */
export function useFoodsWithPortionsLoader() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return async (foodIds: readonly string[]): Promise<Map<string, LoadedFood>> => {
    const loaded = await Promise.all(
      [...new Set(foodIds)].map(async (id) => {
        const [food, portions] = await Promise.all([
          queryClient.query({
            queryKey: keys.foods.detail(id),
            queryFn: () => getFood(client, id),
          }),
          queryClient.query({
            queryKey: keys.foods.portions(id),
            queryFn: () => listFoodPortions(client, id),
          }),
        ]);
        return food === null ? null : ([id, { food, portions }] as const);
      }),
    );
    return new Map(loaded.flatMap((entry) => (entry === null ? [] : [entry])));
  };
}
