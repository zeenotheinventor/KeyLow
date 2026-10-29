import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { SHOPPING_LIST_SCOPE } from "./shoppingListScope";
import { setShoppingItemChecked } from "../repos/shoppingList";

import type { ShoppingItem } from "@keylow/core/shopping";

export type ToggleShoppingItemInput = { id: string; checked: boolean };

/**
 * Ticks an item, or unticks it with `checked: false`. The cached list changes at once, without waiting
 * for the request, and is put back as it was if the request fails. The list is refreshed once it settles.
 */
export function useToggleShoppingItem() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SHOPPING_LIST_SCOPE,
    mutationFn: ({ id, checked }: ToggleShoppingItemInput) =>
      setShoppingItemChecked(client, id, checked),
    onMutate: async ({ id, checked }) => {
      // A read already on its way would bring the old tick back over the optimistic one.
      await queryClient.cancelQueries({ queryKey: keys.shoppingList.items });
      const previous = queryClient.getQueryData<ShoppingItem[]>(keys.shoppingList.items);
      const checkedAt = checked ? new Date().toISOString() : null;
      queryClient.setQueryData<ShoppingItem[]>(keys.shoppingList.items, (list) =>
        list?.map((item) => (item.id === id ? { ...item, checked_at: checkedAt } : item)),
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
