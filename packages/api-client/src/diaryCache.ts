import { compareEntriesByTime } from "@keylow/core/diary";

import { keys } from "./queryKeys";

import type { DiaryDay } from "./repos/diary";
import type { LogEntry } from "./repos/diarySchemas";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Puts an entry into its cached day, in timeline order, replacing the one with the same id. A day
 * that is not cached is left alone, since the day's first read will find the entry. The day's
 * totals are not touched: they come from the database, and the refresh that follows every write
 * brings them up to date.
 */
export function putEntryInDay(queryClient: QueryClient, entry: LogEntry): void {
  // An entry that is open on its own screen shows the row that was stored. One that is not open is not cached.
  queryClient.setQueriesData<LogEntry | null>({ queryKey: keys.diary.entry(entry.id) }, (open) =>
    open === undefined ? undefined : entry,
  );
  queryClient.setQueryData<DiaryDay>(keys.diary.day(entry.local_date), (day) =>
    day === undefined
      ? undefined
      : {
          ...day,
          entries: [...day.entries.filter(({ id }) => id !== entry.id), entry].sort(
            compareEntriesByTime,
          ),
        },
  );
}

/** The entry with this id in any cached day, or undefined when no cached day has it. */
export function entryInCachedDays(queryClient: QueryClient, id: string): LogEntry | undefined {
  for (const [, day] of queryClient.getQueriesData<DiaryDay>({ queryKey: keys.diary.days })) {
    const entry = day?.entries.find((candidate) => candidate.id === id);
    if (entry !== undefined) {
      return entry;
    }
  }
  return undefined;
}

/** Takes an entry out of a cached day. A day that is not cached is left alone. */
export function removeEntryFromDay(queryClient: QueryClient, localDate: string, id: string): void {
  queryClient.setQueryData<DiaryDay>(keys.diary.day(localDate), (day) =>
    day === undefined
      ? undefined
      : { ...day, entries: day.entries.filter((entry) => entry.id !== id) },
  );
}

/**
 * Marks an entry as gone in the cache of its own screen, which is what a read of an entry that was
 * deleted resolves to. The cache of a phone is kept on it, so a deleted entry must not stay in it
 * while its day no longer holds it. An entry that was never opened is not cached, and stays so.
 */
export function markEntryGone(queryClient: QueryClient, id: string): void {
  queryClient.setQueriesData<LogEntry | null>({ queryKey: keys.diary.entry(id) }, (open) =>
    open === undefined ? undefined : null,
  );
}

/**
 * Marks every cached day, every open entry, every cached week and the recent foods stale, so the ones on screen
 * refetch (a write changes the entries, the totals on the week strip and the "last logged" amounts).
 * The complete days are left alone: no entry write changes whether a day is complete. It does not
 * wait for the refetches, so a mutation settles as soon as the write has, and an Undo toast does
 * not wait for a round trip.
 */
export function refreshDiary(queryClient: QueryClient): void {
  for (const queryKey of [
    keys.diary.days,
    keys.diary.entries,
    keys.diary.weeks,
    keys.diary.recentFoods,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * The mutation scope that delete and restore share. Mutations of one scope run one after another,
 * so an Undo tapped while the delete is still on its way waits for it instead of racing it. The
 * log hooks are outside the scope, so one-tap adds stay parallel.
 */
export const ENTRY_VISIBILITY_SCOPE = { id: "diary-entry-visibility" } as const;
