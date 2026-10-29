import { aggregateIngredients } from "@keylow/core/shopping";
import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getShoppingSources } from "../repos/shoppingList";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { ShoppingRecipeChoice } from "./useAddRecipesToList";
import type { AggregatedIngredients } from "@keylow/core/shopping";

export type ShoppingPreviewState =
  | { status: "loading" }
  | {
      status: "error";
      /** The action and the error code. For logs and bug reports only, the UI must never render it. */
      debugMessage: string;
      retry: () => void;
    }
  | { status: "ready"; preview: AggregatedIngredients };

/**
 * What adding recipes at the chosen servings would put on the list, before anything is written: the
 * foods to buy and the store cupboard staples left out, each summed over the recipes, as core works them
 * out (`aggregateIngredients`). The recipes are read once and the servings change only the sums, so a
 * stepper never sends a request. A recipe that is not visible to the user is left out. Key
 * `keys.shoppingList.sources(ids)`, which no device keeps.
 *
 * The servings must be ones `scaleFactor` accepts, which the stepper only ever gives.
 */
export function useShoppingPreview(
  recipes: readonly ShoppingRecipeChoice[],
  { enabled = true }: DiaryReadOptions = {},
): ShoppingPreviewState {
  const client = useSupabase();
  const recipeIds = recipes.map(({ id }) => id);

  const sources = useQuery({
    queryKey: keys.shoppingList.sources(recipeIds),
    queryFn: () => getShoppingSources(client, recipeIds),
    enabled: enabled && recipeIds.length > 0,
  });

  if (sources.data === undefined) {
    return sources.isError
      ? {
          status: "error",
          debugMessage: sources.error.message,
          retry: () => {
            void sources.refetch();
          },
        }
      : { status: "loading" };
  }

  return {
    status: "ready",
    preview: aggregateIngredients(
      recipes.flatMap(({ id, servings }) => {
        const recipe = sources.data.find((source) => source.id === id);
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
      }),
    ),
  };
}
