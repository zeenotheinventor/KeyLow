import { useMutation, useQueryClient } from "@tanstack/react-query";

import { parseCustomFoodInput } from "../customFoodInput";
import { invalidateFoodQueries } from "../invalidateFoodQueries";
import { useSupabase } from "../KeyLowProvider";
import { FoodsPartialWriteError, updateFood } from "../repos/foods";

type UpdateFoodVariables = { id: string; input: unknown };

/**
 * Edits a custom food and replaces its portions. The input is validated before any request is made.
 * Every foods query except the Open Food Facts searches is invalidated after a success, and also after a partial write (the food was
 * updated but its portions were not replaced), because the database then differs from the cache.
 */
export function useUpdateFood() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateFoodVariables) =>
      updateFood(client, id, parseCustomFoodInput(input)),
    onSettled: async (_food, error) => {
      // A failed food update wrote nothing, so there is nothing to refresh.
      if (error !== null && !(error instanceof FoodsPartialWriteError)) {
        return;
      }

      // One invalidation of the root key covers the detail, portions, search and barcode keys.
      await invalidateFoodQueries(queryClient);
    },
  });
}
