import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { SHOPPING_LIST_SCOPE } from "./shoppingListScope";
import { deleteShoppingItem } from "../repos/shoppingList";

import type { ShoppingItem } from "@keylow/core/shopping";

/**
 * Removes one item from the list by its id. It leaves the cached list at once, and the list is put back
 * as it was if the request fails. There is no Undo. The list is refreshed once it settles.
 */
export function useRemoveShoppingItem() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SHOPPING_LIST_SCOPE,
    mutationFn: (id: string) => deleteShoppingItem(client, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys.shoppingList.items });
      const previous = queryClient.getQueryData<ShoppingItem[]>(keys.shoppingList.items);
      queryClient.setQueryData<ShoppingItem[]>(keys.shoppingList.items, (list) =>
        list?.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(keys.shoppingList.items, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.shoppingList.items });
    },
  });
}
