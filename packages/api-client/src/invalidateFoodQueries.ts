import { keys } from "./queryKeys";

import type { QueryClient } from "@tanstack/react-query";

// The second segment of `keys.foods.offSearch(q)`.
const OFF_SEARCH_SEGMENT = keys.foods.offSearch("")[1];

/**
 * Marks every foods query stale (detail, portions, search, barcode) so the ones on screen refetch.
 * The Open Food Facts searches are left alone: saving a food does not change what Open Food Facts
 * answers, and refetching them would spend the user's few searches a minute.
 */
export function invalidateFoodQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: keys.foods.all,
    predicate: (query) => query.queryKey[1] !== OFF_SEARCH_SEGMENT,
  });
}
