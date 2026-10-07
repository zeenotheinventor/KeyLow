import { useMutation, useQueryClient } from "@tanstack/react-query";

import { parseCustomFoodInput } from "../customFoodInput";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { FoodsPartialWriteError, createFood } from "../repos/foods";

/**
 * Creates a custom food for the signed in user. The input is validated before any request is made.
 * Once the food exists in the database, whether or not its portions were saved, every foods query
 * is invalidated. A successful create also seeds the new food's detail and portions caches.
 */
export function useCreateFood() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rawInput: unknown) => {
      const input = parseCustomFoodInput(rawInput);

      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to create a food", { cause: error });
      }

      return createFood(client, data.user.id, input);
    },
    onSettled: async (created, error) => {
      // A failed food insert wrote nothing, so there is nothing to refresh.
      if (error !== null && !(error instanceof FoodsPartialWriteError)) {
        return;
      }

      // A single invalidation of the root key covers the detail, portions, search and barcode keys.
      await queryClient.invalidateQueries({ queryKey: keys.foods.all });

      if (created) {
        queryClient.setQueryData(keys.foods.detail(created.food.id), created.food);
        queryClient.setQueryData(keys.foods.portions(created.food.id), created.portions);
      }
    },
  });
}
