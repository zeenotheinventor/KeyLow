import { useMutation, useQueryClient } from "@tanstack/react-query";

import { putEntryInDay, refreshDiary } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { logEntries } from "../repos/diaryWrites";

import type { LogEntriesItem } from "../repos/diaryWrites";

/**
 * Logs everything on the plate, foods and recipe servings, in one request that is all or nothing: a
 * row the database refuses stores none of them, so a plate is never partly logged. Each item takes
 * what `useLogFood` or `useLogRecipeServing` takes, the time included, and the rows keep the order of
 * the list in the diary (see `logEntries`). Needs a connection: there is no offline queue. An empty
 * list, or a row with a bad amount, throws a `RangeError` and sends nothing.
 *
 * `mutateAsync` resolves to the stored rows in the order given. Each is in its day's cache at once, in
 * time order, then the days, weeks and recent foods are refreshed (also after a failure, since a lost
 * response may still have stored the rows). A failed insert leaves the cache as it was.
 */
export function useLogEntries() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    // An offline write fails at once instead of pausing until the connection returns: the plate screen holds
    // its Close while a log is in flight, so a paused write would leave the person with no way out.
    networkMode: "always",
    mutationFn: (items: readonly LogEntriesItem[]) => logEntries(client, items),
    onSuccess: (entries) => {
      for (const entry of entries) {
        putEntryInDay(queryClient, entry);
      }
    },
    // Also after a failure: a lost response may still have stored the rows.
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
