import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateFoodQueries } from "../invalidateFoodQueries";
import { useSupabase } from "../KeyLowProvider";
import { softDeleteFood } from "../repos/foods";

/**
 * Soft deletes one of the caller's own custom foods by id. Every foods query except the Open Food
 * Facts searches is invalidated after a success, so the lists and searches drop the food while its
 * detail still resolves, now with `deleted_at` set. A failed delete wrote nothing, so nothing is refreshed.
 */
export function useDeleteFood() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => softDeleteFood(client, id),
    onSuccess: async () => {
      // One invalidation of the root key covers the detail, portions, search and barcode keys.
      await invalidateFoodQueries(queryClient);
    },
  });
}
