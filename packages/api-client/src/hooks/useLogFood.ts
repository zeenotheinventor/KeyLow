import { useMutation, useQueryClient } from "@tanstack/react-query";

import { putEntryInDay, refreshDiary } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { logFood } from "../repos/diaryWrites";

import type { LogFoodInput } from "../repos/diaryWrites";

/**
 * Logs a food at a time, not in a meal: the entry is built by `buildLogEntry` in core from the
 * food, the amount and `loggedAt`, and inserted. `localDate` and `loggedAt` come from
 * `defaultLoggedAt` in core (now, the clock time on the viewed day, an hour's :00, or the time the
 * user picked), and `loggedAt` is its instant as an ISO string. Needs a connection: there is no
 * offline queue.
 *
 * For the one-tap plus, call `mutateAsync` once per tap. Calls do not wait for each other, and each
 * one resolves to the entry it stored, so the Undo of a toast passes that entry to `useDeleteEntry`
 * and removes only it. (`mutate` callbacks fire for the latest call only, `mutateAsync` for each.)
 *
 * The stored entry is in its day's cache at once, in time order, then the days, weeks and recent
 * foods are refreshed.
 */
export function useLogFood() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LogFoodInput) => logFood(client, input),
    onSuccess: (entry) => {
      putEntryInDay(queryClient, entry);
    },
    // Also after a failure: a lost response may still have stored the row.
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
