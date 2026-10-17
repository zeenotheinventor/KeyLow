import { useMutation, useQueryClient } from "@tanstack/react-query";

import { putEntryInDay, refreshDiary } from "../diaryCache";
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
 * The stored row is in its day's cache at once, in time order, then the days, weeks and recent foods
 * are refreshed (also after a failure, since a lost response may still have stored the row). A failed
 * insert leaves the cache as it was.
 */
export function useLogRecipeServing() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LogRecipeInput) => logRecipe(client, input),
    onSuccess: (entry) => {
      putEntryInDay(queryClient, entry);
    },
    // Also after a failure: a lost response may still have stored the row.
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
