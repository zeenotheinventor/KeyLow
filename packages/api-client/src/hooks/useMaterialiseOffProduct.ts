import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OffProductNotFoundError } from "../errors";
import { invalidateFoodQueries } from "../invalidateFoodQueries";
import { useSupabase } from "../KeyLowProvider";
import { fetchOffProduct } from "../repos/off";
import { seedOffProduct } from "../seedOffProduct";

/**
 * Turns an Open Food Facts search candidate into a food row the user can log, by asking
 * `off-product` for its `code`. Resolves to the food and seeds its detail and portions caches.
 * Once that succeeds, every foods query except the Open Food Facts searches is invalidated, so the
 * local search picks the new food up. Throws an `OffProductNotFoundError` when Open Food Facts has
 * no product with the code, and a `RateLimitedError` when it is rate limited.
 */
export function useMaterialiseOffProduct() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const product = await fetchOffProduct(client, code);

      if (product === null) {
        throw new OffProductNotFoundError(code);
      }

      seedOffProduct(queryClient, product);
      return product.food;
    },
    onSuccess: () => invalidateFoodQueries(queryClient),
  });
}
