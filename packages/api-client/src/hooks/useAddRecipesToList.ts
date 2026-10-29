import { aggregateIngredients, planListMerge } from "@keylow/core/shopping";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { SHOPPING_LIST_SCOPE } from "./shoppingListScope";
import { getShoppingSources, listShoppingItems, saveShoppingItems } from "../repos/shoppingList";

import type { ShoppingRecipe } from "@keylow/core/shopping";

/** A recipe to add, at the servings the person chose. */
export type ShoppingRecipeChoice = { id: string; servings: number };

export type AddRecipesToListInput = {
  recipes: readonly ShoppingRecipeChoice[];
  /** The foods of the store cupboard staples the person chose to add anyway. Nothing is kept of the choice. */
  addAnyway?: readonly string[];
};

/**
 * Adds the ingredients of recipes to the list, all or nothing: it reads the recipes, sums their
 * ingredients at the chosen servings (`aggregateIngredients`), leaves out the store cupboard staples
 * unless their food is in `addAnyway`, reads the list as it is now, works out the merge (`planListMerge`)
 * and writes it in one `save_shopping_items` call. It resolves to how many rows it wrote. The servings
 * must be ones `scaleFactor` accepts, or it rejects with its `RangeError` before any request is made
 * for the write. The list is refreshed once it settles, also after a failure.
 */
export function useAddRecipesToList() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: SHOPPING_LIST_SCOPE,
    mutationFn: async ({ recipes, addAnyway = [] }: AddRecipesToListInput) => {
      const sources = await getShoppingSources(
        client,
        recipes.map(({ id }) => id),
      );
      const chosen: ShoppingRecipe[] = recipes.flatMap(({ id, servings }) => {
        const recipe = sources.find((source) => source.id === id);
        return recipe === undefined
          ? []
          : [
              {
                recipeId: recipe.id,
                recipeName: recipe.name,
                recipeServings: recipe.servings,
                chosenServings: servings,
                ingredients: recipe.ingredients,
              },
            ];
      });
      const { items, staples } = aggregateIngredients(chosen);
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
