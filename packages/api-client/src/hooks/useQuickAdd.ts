import { useMutation, useQueryClient } from "@tanstack/react-query";

import { putEntryInDay, refreshDiary } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { logQuickEntry } from "../repos/diaryWrites";

import type { LogQuickEntryInput } from "../repos/diaryWrites";

/**
 * Logs a quick add (calories, optional macros and label) at a time, with `buildQuickEntry` from
 * core. `loggedAt` and `localDate` are as for `useLogFood`. Resolves to the stored entry, which is
 * in its day's cache at once. Days, weeks and recent foods are then refreshed.
 */
export function useQuickAdd() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LogQuickEntryInput) => logQuickEntry(client, input),
    onSuccess: (entry) => {
      putEntryInDay(queryClient, entry);
    },
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
