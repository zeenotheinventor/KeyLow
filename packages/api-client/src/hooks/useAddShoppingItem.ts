import { planTypedItem } from "@keylow/core/shopping";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { SHOPPING_LIST_SCOPE } from "./shoppingListScope";
import { addShoppingItem, listShoppingItems } from "../repos/shoppingList";

import type { ShoppingItem } from "@keylow/core/shopping";

/**
 * Adds an item typed by hand to the end of the list (`planTypedItem`) and resolves to it as stored, or
 * to null with no request when the words are blank. The end is read from the list as it is now. The
 * item joins the cached list once stored, and the list is refreshed once it settles.
 */
export function useAddShoppingItem() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SHOPPING_LIST_SCOPE,
    mutationFn: async (typed: string): Promise<ShoppingItem | null> => {
      if (typed.trim() === "") {
        return null;
      }
      const row = planTypedItem(await listShoppingItems(client), typed);
      return row === null ? null : addShoppingItem(client, row);
    },
    onSuccess: (item) => {
      if (item !== null) {
        queryClient.setQueryData<ShoppingItem[]>(keys.shoppingList.items, (list) =>
          list === undefined ? list : [...list, item],
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.shoppingList.items });
    },
  });
}
