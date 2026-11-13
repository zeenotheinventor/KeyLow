import { planShoppingDraftsOf } from "@keylow/core/plans";
import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getPlannedFoods, getShoppingSources } from "../repos/shoppingList";

import type { ShoppingPreviewState } from "./useShoppingPreview";
import type { Database } from "../database.types";
import type { PlanShopping } from "@keylow/core/plans";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The recipes and foods a plan's shopping reads, as they are now. Shared by the preview and the add. */
export const readPlanShoppingSources = async (
  client: SupabaseClient<Database>,
  shopping: PlanShopping,
) => {
  const [recipes, foods] = await Promise.all([
    getShoppingSources(client, shopping.recipeIds),
    getPlannedFoods(
      client,
      shopping.foods.map(({ foodId }) => foodId),
    ),
  ]);
  return { recipes, foods };
};

/**
 * What adding the days of a plan would put on the list, before anything is written: the foods to buy and the
 * store cupboard staples left out, summed by core (`shoppingDraftsOfPlan`) over the days that are not confirmed.
 * The recipes and foods are read once. A null `shopping` (nothing to buy) reads nothing and stays loading. A
 * recipe the plan names that cannot be read now is an error, so nothing is shown half summed. Key
 * `keys.shoppingList.planSources`, which no device keeps.
 */
export function usePlanShoppingPreview(
  shopping: PlanShopping | null,
  { enabled = true }: { enabled?: boolean } = {},
): ShoppingPreviewState {
  const client = useSupabase();
  const recipeIds = shopping?.recipeIds ?? [];
  const foodIds = shopping?.foods.map(({ foodId }) => foodId) ?? [];

  const sources = useQuery({
    queryKey: keys.shoppingList.planSources(recipeIds, foodIds),
    queryFn: () =>
      shopping === null
        ? Promise.resolve({ recipes: [], foods: [] })
        : readPlanShoppingSources(client, shopping),
    enabled: enabled && shopping !== null,
  });

  if (shopping === null || sources.data === undefined) {
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

  try {
    return {
      status: "ready",
      preview: planShoppingDraftsOf(shopping, sources.data.recipes, sources.data.foods),
    };
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
    // A recipe the plan names is not one the user can read now. Nothing about it is quoted.
    return {
      status: "error",
      debugMessage: "Could not sum the plan for your shopping list (missing)",
      retry: () => {
        void sources.refetch();
      },
    };
  }
}
