import { useQuery, useQueryClient } from "@tanstack/react-query";

import { entryInCachedDays } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { getLogEntry } from "../repos/diary";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads one live entry by its id, for the screen that edits it, and resolves to null when there is none (it
 * does not exist, was deleted, or is not the caller's). Key `keys.diary.entry(id)`. An entry that a cached
 * day already holds is the starting point, so a row that was tapped opens at once and offline, and the read
 * then confirms it. A write puts the entry it stored here, and refreshes it after, so the entry on screen
 * is the latest row: the one `useUpdateEntry` wants.
 */
export function useLogEntry(id: string, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: keys.diary.entry(id),
    queryFn: () => getLogEntry(client, id),
    initialData: () => entryInCachedDays(queryClient, id),
    enabled,
    retry: retryUnlessRangeError,
  });
}
