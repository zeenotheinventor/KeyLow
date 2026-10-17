import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listRecipes } from "../repos/recipes";

import type { DiaryReadOptions } from "./DiaryReadOptions";

export type UseRecipesOptions = DiaryReadOptions & {
  /**
   * False, the default, lists live recipes only. True lists archived recipes as well, each row saying
   * which it is in `is_archived`.
   */
  archived?: boolean;
};

/**
 * Loads the signed in user's recipe library, by name. Each recipe carries its `computed` nutrition
 * cache and not its ingredients or steps, which `useRecipe` loads. A recipe is health data, so an error
 * names the action and the code only. Key `keys.recipes.list(archived)`.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all. The mobile app
 * passes `useReadsEnabled()` from the screens, since the `(tabs)` stay mounted under the terms gate.
 */
export function useRecipes({ archived = false, enabled = true }: UseRecipesOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.recipes.list(archived),
    queryFn: () => listRecipes(client, { archived }),
    enabled,
  });
}
