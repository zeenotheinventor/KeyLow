import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { previewRecipeRefresh } from "../repos/recipes";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { RecipeRefreshDiff } from "../repos/recipes";

export type RecipeRefreshPreviewState =
  | { status: "loading" }
  | {
      status: "error";
      /** The action and the error code. For logs and bug reports only, the UI must never render it. */
      debugMessage: string;
    }
  | { status: "notFound" }
  | { status: "ready"; diff: RecipeRefreshDiff; hasChanges: boolean };

/**
 * What "Refresh ingredients" would change in a recipe, as a screen state, without writing anything: the
 * recipe and the current food of each ingredient are read and core works out the before and after. It is
 * the only look at the foods a recipe has, because a changed food reaches a recipe by a refresh and by no
 * other way. `notFound` means the recipe is not visible to the user. A food read that fails fails the
 * whole preview, so a partial diff is never shown. `error` is only taken when there is no diff to show yet.
 * Key `keys.recipes.refresh(id)`.
 *
 * The preview is stale-sensitive: it is read afresh whenever a screen opens it and is not kept after the
 * screen goes, so it never shows the diff of an earlier look at foods that have changed since. It is
 * not put in the mobile persisted cache, which keeps the diary reads only.
 *
 * Nothing is asked while `id` is undefined or empty, and the state is `loading`. `enabled` is the same
 * option the diary reads take: false makes no request at all, and the state is `loading` while nothing
 * has been asked.
 */
export function useRecipeRefreshPreview(
  id: string | undefined,
  { enabled = true }: DiaryReadOptions = {},
): RecipeRefreshPreviewState {
  const client = useSupabase();

  const preview = useQuery({
    queryKey: keys.recipes.refresh(id ?? ""),
    queryFn: id ? () => previewRecipeRefresh(client, id) : skipToken,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });

  if (preview.data === undefined) {
    return preview.isError
      ? { status: "error", debugMessage: preview.error.message }
      : { status: "loading" };
  }
  if (preview.data === null) {
    return { status: "notFound" };
  }
  return { status: "ready", diff: preview.data, hasChanges: preview.data.hasChanges };
}
