import { planShoppingDraftsOf } from "@keylow/core/plans";
import { planListMerge } from "@keylow/core/shopping";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { SHOPPING_LIST_SCOPE } from "./shoppingListScope";
import { readPlanShoppingSources } from "./usePlanShoppingPreview";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listShoppingItems, saveShoppingItems } from "../repos/shoppingList";

import type { PlanShopping } from "@keylow/core/plans";

export type AddPlanToListInput = {
  shopping: PlanShopping;
  /** The foods of the store cupboard staples the person chose to add anyway. Nothing is kept of the choice. */
  addAnyway?: readonly string[];
};

/**
 * Adds the foods of a plan's unconfirmed days to the list, all or nothing, as `useAddRecipesToList` adds a
 * recipe: it reads the recipes and foods, lets core sum them (`shoppingDraftsOfPlan`), leaves out the store
 * cupboard staples unless their food is in `addAnyway`, reads the list as it is now, works out the merge
 * (`planListMerge`) and writes it in one `save_shopping_items` call. Adding the same days twice adds the
 * amounts twice, as adding a recipe twice does. It resolves to how many rows it wrote, and rejects with a
 * `RangeError` before any write when a recipe the plan names cannot be read. The list is refreshed once it
 * settles, also after a failure.
 */
export function useAddPlanToList() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SHOPPING_LIST_SCOPE,
    mutationFn: async ({ shopping, addAnyway = [] }: AddPlanToListInput) => {
      const { recipes, foods } = await readPlanShoppingSources(client, shopping);
      const { items, staples } = planShoppingDraftsOf(shopping, recipes, foods);
      const drafts = [...items, ...staples.filter(({ foodId }) => addAnyway.includes(foodId))];
      const { upserts } = planListMerge(await listShoppingItems(client), drafts);
      await saveShoppingItems(client, upserts);
      return upserts.length;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.shoppingList.items });
    },
  });
}
