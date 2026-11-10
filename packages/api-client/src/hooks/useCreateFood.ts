import { useMutation, useQueryClient } from "@tanstack/react-query";

import { parseCustomFoodInput } from "../customFoodInput";
import { invalidateFoodQueries } from "../invalidateFoodQueries";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { createFood } from "../repos/foods";

/**
 * Creates a custom food for the signed in user. The input is validated before any request is made.
 * The food and its portions are written together, so a failed create wrote nothing and no cache is touched.
 * A successful create invalidates every foods query, except the Open Food Facts searches, and seeds the new
 * food's detail and portions caches.
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
    onSuccess: async (created) => {
      // One invalidation of the root key covers the detail, portions, search and barcode keys.
      await invalidateFoodQueries(queryClient);

      queryClient.setQueryData(keys.foods.detail(created.food.id), created.food);
      queryClient.setQueryData(keys.foods.portions(created.food.id), created.portions);
    },
  });
}
