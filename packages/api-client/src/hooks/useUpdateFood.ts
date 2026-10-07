import { useMutation, useQueryClient } from "@tanstack/react-query";

import { parseCustomFoodInput } from "../customFoodInput";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { FoodsPartialWriteError, updateFood } from "../repos/foods";

type UpdateFoodVariables = { id: string; input: unknown };

/**
 * Edits a custom food and replaces its portions. The input is validated before any request is made.
 * Every foods query is invalidated after a success, and also after a partial write (the food was
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

      // The ticket lists the detail, portions and all keys. The root key is a prefix of the other
      // two (see the nesting test in queryKeys.test.ts), so one invalidation covers all three.
      await queryClient.invalidateQueries({ queryKey: keys.foods.all });
    },
  });
}
