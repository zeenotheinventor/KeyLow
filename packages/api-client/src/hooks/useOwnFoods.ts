import { useInfiniteQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { OWN_FOODS_PAGE_SIZE, listOwnFoods } from "../repos/foods";

import type { Food } from "@keylow/core/schemas";
import type { InfiniteData } from "@tanstack/react-query";

// Every food loaded so far in one list. A food that moved to the page before while the pages were
// loading can be read twice, so a food is kept at its first place only.
function toUniqueFoods(data: InfiniteData<Food[]>): Food[] {
  const seenIds = new Set<string>();

  return data.pages.flat().filter((food) => {
    if (seenIds.has(food.id)) {
      return false;
    }
    seenIds.add(food.id);
    return true;
  });
}

/**
 * Loads the signed in user's own foods by name, a page of 50 at a time, with no query needed.
 * `data` is every food loaded so far in one list. `fetchNextPage` loads the page after it while
 * `hasNextPage` is true, and `isFetchingNextPage` says that page is on its way. Creating,
 * updating or deleting a food refreshes every page loaded, since each invalidates every foods query.
 */
export function useOwnFoods() {
  const client = useSupabase();

  return useInfiniteQuery({
    queryKey: keys.foods.own,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listOwnFoods(client, { offset: pageParam }),
    // A page that is not full was the last one.
    getNextPageParam: (lastPage, _pages, lastOffset) =>
      lastPage.length < OWN_FOODS_PAGE_SIZE ? undefined : lastOffset + lastPage.length,
    select: toUniqueFoods,
  });
}
