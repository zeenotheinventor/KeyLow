import { isBeforePortionRules } from "@keylow/core/foods";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { fetchOffProduct } from "../repos/off";
import { seedOffProduct } from "../seedOffProduct";

import type { Food } from "@keylow/core/schemas";

/** The Open Food Facts code of a food stored before the current portion rules, or undefined when it needs no refresh. */
function outdatedOffCodeOf(food: Food | null | undefined): string | undefined {
  if (
    food?.source !== "off" ||
    food.source_ref === null ||
    food.fetched_at === null ||
    !isBeforePortionRules(food.fetched_at)
  ) {
    return undefined;
  }
  return food.source_ref;
}

/**
 * Asks `off-product` for a branded food that was stored before the current portion rules, so its new
 * portions appear on the screen that shows it. The answer is put in the food's detail and portions caches
 * (`seedOffProduct`), and the screen follows them with no spinner and no message. A food from anywhere
 * else, one fetched since the rules, and one without a source reference are left alone.
 *
 * Each food is asked for once while the app runs: a screen opened again, a foods invalidation and a
 * returning connection do not repeat it, and neither does a failure, because the screen already works from
 * the old portions and a rate limit will not pass by trying again. Offline, the request waits for the
 * connection. Every failure is swallowed, and nothing is logged, because a food and its amounts are health data.
 */
export function useRefreshOutdatedOffFood(food: Food | null | undefined): void {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const code = outdatedOffCodeOf(food);

  useQuery({
    queryKey: keys.offRefresh(code ?? ""),
    queryFn:
      code === undefined
        ? skipToken
        : async () => {
            const product = await fetchOffProduct(client, code);
            if (product !== null) {
              // A read of the food that is still on its way started before the refresh and would put the old portions back.
              await queryClient.cancelQueries({ queryKey: keys.foods.detail(product.food.id) });
              seedOffProduct(queryClient, product);
            }
            // The answer is in the caches. What the query holds is only that the food was asked for.
            return product !== null;
          },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
