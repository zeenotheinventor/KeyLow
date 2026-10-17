import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refreshDiary } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { logRecipe } from "../repos/recipeEntries";

import type { LogRecipeInput } from "../repos/recipeEntries";

/**
 * Logs an amount of a recipe, by serving or by grams of cooked weight, at a time: the entry is built
 * by `buildRecipeLogEntry` in core from the recipe as the caller holds it, the amount and `loggedAt`,
 * and inserted. `localDate` and `loggedAt` come from `defaultLoggedAt` in core, as for `useLogFood`.
 * Needs a connection: there is no offline queue. A bad amount throws a `RangeError` and sends nothing.
 *
 * Like `useLogFood`, calls do not wait for each other and `mutateAsync` resolves to the row each one
 * stored, whose `id` is what the Undo of a toast needs.
 *
 * Unlike `useLogFood` it does not put the row into its day. The diary cache types know food and quick
 * entries only, so the days, weeks and recent foods are marked stale when the insert settles (also
 * after a failure, since a lost response may still have stored the row) and read again.
 *
 * NO SCREEN MAY CALL THIS YET. The diary reads (`getDiaryDay`, `getDiaryWeek` and the rest) do not
 * know recipe entries: a day holding one fails to parse, and the apps would show a recipe entry as a
 * quick add. The hook is exported and unused until the diary reads recipe entries, which lands with
 * the first diary slice of the recipes screens (KEY-4).
 */
export function useLogRecipeServing() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LogRecipeInput) => logRecipe(client, input),
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
