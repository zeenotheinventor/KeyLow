import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import { newestCachedTrendRead } from "./newestCachedTrendRows";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { trendReadWindow } from "./trendReadWindow";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listTrendSets } from "../repos/trainingTrend";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { TrendSetRows } from "../repos/trainingSchemas";
import type { TrendRange } from "@keylow/core/training";

/** A trend read, and when the rows it gives were read. */
export type ExerciseTrendSetsRead = TrainingReadResult<TrendSetRows> & {
  /**
   * When the rows in `data` were read, in milliseconds, or undefined while there are none. It moves on when a
   * refetch returns the same rows. Rows that stand in from an earlier read (see below) have that read's time.
   */
  dataUpdatedAt: number | undefined;
};

export type UseTrendSetsOptions = DiaryReadOptions & {
  /** The moment the range ends at, an ISO timestamp with a zone. Today is read from it in the profile's zone. */
  now: string;
};

/**
 * The rows one exercise's weekly trend is worked out from: its live working sets from the Monday that
 * starts `range` (4 weeks, 3 months or a year, the current week included) through today, and the sets of
 * the last week it was trained before that, so the first trained week has something to compare with.
 * Every session counts, free sessions and other routines' too, and a session still open. The screen gives
 * these rows to core's `exerciseWeeklyTrend`, so the trend is worked out at read time and never stale.
 *
 * What is cached is narrow rows under `keys.training.exerciseTrend(exerciseId, fromWeek)`: an id and the
 * Monday, never a name or a load. They are kept in the mobile cache so the trend opens without a
 * connection, and every set or session write marks them stale (`refreshSessions`). The result is pending
 * until the profile's time zone is read. When this week's rows are not there yet (a phone offline in a
 * later week than it last read), the rows of the newest earlier read stand in until they are, and
 * `dataUpdatedAt` is the time of that read. Nothing is asked while `exerciseId` is undefined, and `enabled`
 * false makes no request at all. An id that is not a UUID fails without a request, as an error that is
 * not retried. A failure names the action and the database code only.
 */
export function useExerciseTrendSets(
  exerciseId: string | undefined,
  range: TrendRange,
  { now, enabled = true }: UseTrendSetsOptions,
): ExerciseTrendSetsRead {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const timeZone = useProfileTimeZone({ enabled });

  // A profile with no zone reads in UTC, as every other screen does; the zone not read yet reads nothing.
  const window =
    timeZone.data === undefined ? null : trendReadWindow(range, now, timeZone.data ?? "UTC");

  const rows = useQuery<TrendSetRows>({
    queryKey: keys.training.exerciseTrend(exerciseId ?? "", window?.fromWeek ?? ""),
    queryFn:
      exerciseId === undefined || window === null
        ? skipToken
        : () => listTrendSets(client, [exerciseId], window),
    // A phone offline in a later week than it last read shows the newest rows it holds meanwhile.
    placeholderData: () =>
      exerciseId === undefined || window === null
        ? undefined
        : newestCachedTrendRead(
            queryClient,
            keys.training.exerciseTrendAll,
            exerciseId,
            window.fromWeek,
          )?.rows,
    enabled,
    retry: retryUnlessRangeError,
  });

  // Rows that stand in were read under another key, whose read time is theirs. The placeholder is the
  // newest such read, and so is the one looked up here.
  const standInRead =
    rows.isPlaceholderData && exerciseId !== undefined && window !== null
      ? newestCachedTrendRead(
          queryClient,
          keys.training.exerciseTrendAll,
          exerciseId,
          window.fromWeek,
        )
      : undefined;
  const dataUpdatedAt = rows.isPlaceholderData ? standInRead?.dataUpdatedAt : rows.dataUpdatedAt;

  return { ...toTrainingReadResult(rows, [timeZone], []), dataUpdatedAt };
}
