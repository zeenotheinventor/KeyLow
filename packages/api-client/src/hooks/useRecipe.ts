import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getRecipe } from "../repos/recipes";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { RecipeDetail } from "../repos/recipes";

export type RecipeState =
  | { status: "loading" }
  | {
      status: "error";
      /** The action and the error code. For logs and bug reports only, the UI must never render it. */
      debugMessage: string;
    }
  | { status: "notFound" }
  | { status: "ready"; recipe: RecipeDetail };

/**
 * One recipe, with its ingredients in list order and its steps, as a screen state. `notFound` means the
 * recipe is not visible to the user (it does not exist, or is not theirs), and is a state and not an
 * error. `error` is only taken when there is no recipe to show yet, so a failed background refetch
 * never replaces a recipe the user is looking at. Key `keys.recipes.detail(id)`.
 *
 * Nothing is asked while `id` is undefined or empty, and the state is `loading`. `enabled` is the same
 * option the diary reads take: false makes no request at all, and the state is `loading` while
 * nothing has been asked. The mobile app passes `useReadsEnabled()` from the screens, since the
 * `(tabs)` stay mounted under the terms gate.
 */
export function useRecipe(
  id: string | undefined,
  { enabled = true }: DiaryReadOptions = {},
): RecipeState {
  const client = useSupabase();

  const recipe = useQuery({
    queryKey: keys.recipes.detail(id ?? ""),
    queryFn: id ? () => getRecipe(client, id) : skipToken,
    enabled,
  });

  if (recipe.data === undefined) {
    return recipe.isError
      ? { status: "error", debugMessage: recipe.error.message }
      : { status: "loading" };
  }
  if (recipe.data === null) {
    return { status: "notFound" };
  }
  return { status: "ready", recipe: recipe.data };
}
