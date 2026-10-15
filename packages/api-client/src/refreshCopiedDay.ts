import { keys } from "./queryKeys";
import { weekStartOf } from "./weekStartOf";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Marks stale what a day copy (or its Undo) changes, so the ones on screen refetch: the day the
 * entries were copied onto, the week that day is in (its totals) and the recent foods. The source
 * day and the complete days are not changed by a copy. It does not wait for the refetches, so a
 * mutation settles as soon as the write has and an Undo toast does not wait for a round trip.
 */
export function refreshCopiedDay(queryClient: QueryClient, localDate: string): void {
  for (const queryKey of [
    keys.diary.day(localDate),
    keys.diary.week(weekStartOf(localDate)),
    keys.diary.recentFoods,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
