import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  ENTRY_VISIBILITY_SCOPE,
  putEntryInDay,
  refreshDiary,
  removeEntryFromDay,
} from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { restoreLogEntry } from "../repos/diaryWrites";

import type { LogEntry } from "../repos/diarySchemas";

/**
 * Brings a deleted entry back (the Undo toast of a delete, shown for 5 s). Pass the entry that was
 * passed to `useDeleteEntry`: it goes back into its day in the cache at once, in time order, and
 * comes out again if the request fails. Days, weeks and recent foods are refreshed after the request.
 */
export function useRestoreEntry() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: ENTRY_VISIBILITY_SCOPE,
    mutationFn: (entry: LogEntry) => restoreLogEntry(client, entry.id),
    onMutate: async (entry) => {
      await queryClient.cancelQueries({ queryKey: keys.diary.day(entry.local_date) });
      putEntryInDay(queryClient, entry);
    },
    onError: (_error, entry) => {
      removeEntryFromDay(queryClient, entry.local_date, entry.id);
    },
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
