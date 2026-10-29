import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { SHOPPING_LIST_SCOPE } from "./shoppingListScope";
import { clearTickedItems } from "../repos/shoppingList";

import type { ShoppingItem } from "@keylow/core/shopping";

/**
 * Removes every ticked item. They leave the cached list at once, and the list is put back as it was if
 * the request fails. The screen asks first, since there is no Undo. The list is refreshed once it settles.
 */
export function useClearTickedItems() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SHOPPING_LIST_SCOPE,
    mutationFn: () => clearTickedItems(client),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keys.shoppingList.items });
      const previous = queryClient.getQueryData<ShoppingItem[]>(keys.shoppingList.items);
      queryClient.setQueryData<ShoppingItem[]>(keys.shoppingList.items, (list) =>
        list?.filter((item) => item.checked_at === null),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(keys.shoppingList.items, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.shoppingList.items });
    },
  });
}
