import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listShoppingItems } from "../repos/shoppingList";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the signed in user's shopping list, ticked items included, in list order. Core's
 * `groupShoppingList` splits it into what is still to buy and what is ticked. The list is health data,
 * so an error names the action and the code only. Key `keys.shoppingList.items`, which no device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function useShoppingList({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.shoppingList.items,
    queryFn: () => listShoppingItems(client),
    enabled,
  });
}
