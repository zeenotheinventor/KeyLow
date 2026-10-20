import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import { newestCachedTrendRows } from "./newestCachedTrendRows";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { trendReadWindow } from "./trendReadWindow";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getRoutine } from "../repos/routines";
import { listTrendSets } from "../repos/trainingTrend";

import type { TrainingReadResult } from "./trainingReadResult";
import type { UseTrendSetsOptions } from "./useExerciseTrendSets";
import type { TrendSetRows } from "../repos/trainingSchemas";
import type { TrendRange } from "@keylow/core/training";

/**
 * The rows the weekly trend of every exercise of one routine is worked out from, read together: one
 * request for the sets of the range of all its exercises, and one for their earlier weeks, never one per
 * exercise. The rows of all the exercises come back mixed, each carrying its `exercise_id`, for core's
 * `routineTrendsByDay` to group by routine day at read time. Everything else is as `useExerciseTrendSets`:
 * every session counts, the rows are narrow and kept in the mobile cache under
 * `keys.training.routineTrend(routineId, fromWeek)`, and a set, session or routine write marks them stale.
 *
 * The routine is read inside the query, from the cache the routine screens share (`keys.training.routine`)
 * or the database, so a routine edit changes the exercises read and not only the key. The result is pending
 * until the time zone and the rows are read. A routine that does not exist or is not the user's has no
 * exercises, so its rows are empty. When this week's rows are not there yet (a phone offline in a later
 * week than it last read), the rows of the newest earlier read stand in until they are.
 */
export function useRoutineTrendSets(
  routineId: string | undefined,
  range: TrendRange,
  { now, enabled = true }: UseTrendSetsOptions,
): TrainingReadResult<TrendSetRows> {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const timeZone = useProfileTimeZone({ enabled });

  // A profile with no zone reads in UTC, as every other screen does; the zone not read yet reads nothing.
  const window =
    timeZone.data === undefined ? null : trendReadWindow(range, now, timeZone.data ?? "UTC");

  const rows = useQuery<TrendSetRows>({
    queryKey: keys.training.routineTrend(routineId ?? "", window?.fromWeek ?? ""),
    queryFn:
      routineId === undefined || window === null
        ? skipToken
        : async () => {
            // The exercises are those of the routine as it is cached when the read is made, so a saved
            // routine (which puts itself in the cache and marks this read stale) is read with its new list.
            const routine = await queryClient.query({
              queryKey: keys.training.routine(routineId),
              queryFn: () => getRoutine(client, routineId),
              staleTime: "static",
            });
            return listTrendSets(
              client,
              (routine?.days ?? []).flatMap((day) =>
                day.exercises.map((planned) => planned.exercise.id),
              ),
              window,
            );
          },
    // A phone offline in a later week than it last read shows the newest rows it holds meanwhile.
    placeholderData: () =>
      routineId === undefined || window === null
        ? undefined
        : newestCachedTrendRows(
            queryClient,
            keys.training.routineTrendAll,
            routineId,
            window.fromWeek,
          ),
    enabled,
    retry: retryUnlessRangeError,
  });

  return toTrainingReadResult(rows, [timeZone], []);
}
