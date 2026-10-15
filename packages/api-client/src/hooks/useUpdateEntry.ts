import { useMutation, useQueryClient } from "@tanstack/react-query";

import { putEntryInDay, refreshDiary, removeEntryFromDay } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { updateLogEntry } from "../repos/diaryWrites";

import type { EntryUpdate } from "../repos/diaryWrites";

/**
 * Edits an entry and resolves to the stored row. Pass the entry as the diary returned it, and what
 * to change (see `EntryUpdate`):
 *
 * - `amount`: a new quantity, unit or portion, recomputed from the entry's own snapshot, so an
 *   edit of the food since then changes nothing;
 * - `useCurrentFoodData`: "Update to current food data", rebuilt from the food as it is now (read
 *   without hiding a deleted food), keeping the amount;
 * - `time`: a new `loggedAt` and the profile's time zone. `local_date` is recomputed, so moving an
 *   entry across midnight moves it to the other day.
 *
 * They are written in one request. The stored entry replaces the old one in the cache (and leaves
 * the old day if the day changed), then the days, weeks and recent foods are refreshed.
 */
export function useUpdateEntry() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: EntryUpdate) => updateLogEntry(client, update),
    onSuccess: (updated, { entry }) => {
      if (entry.local_date !== updated.local_date) {
        removeEntryFromDay(queryClient, entry.local_date, entry.id);
      }
      putEntryInDay(queryClient, updated);
    },
    onSettled: () => {
      refreshDiary(queryClient);
    },
  });
}
