import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  ENTRY_VISIBILITY_SCOPE,
  putEntryInDay,
  refreshDiary,
  removeEntryFromDay,
} from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { softDeleteLogEntry } from "../repos/diaryWrites";

import type { LogEntry } from "../repos/diarySchemas";

/**
 * Soft deletes an entry (`deleted_at`), for the delete action and for the Undo of a log. Pass the
 * entry as the diary returned it: its day is taken out of the cache at once, so the row disappears
 * without waiting, and put back if the request fails. Pass the same entry to `useRestoreEntry` for
 * the Undo toast. Days, weeks and recent foods are refreshed after the request.
 */
export function useDeleteEntry() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: ENTRY_VISIBILITY_SCOPE,
    mutationFn: (entry: LogEntry) => softDeleteLogEntry(client, entry.id),
    onMutate: async (entry) => {
      // A read already on its way would bring the entry back over the optimistic removal.
      await queryClient.cancelQueries({ queryKey: keys.diary.day(entry.local_date) });
      removeEntryFromDay(queryClient, entry.local_date, entry.id);
    },
    onError: (_error, entry) => {
      putEntryInDay(queryClient, entry);
    },
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
