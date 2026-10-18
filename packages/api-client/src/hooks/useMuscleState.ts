import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V1, muscleState, targetedMuscles } from "@keylow/core/training";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { HEAT_LOOKBACK_DAYS, newestCachedSetRows } from "./heatWindowRows";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { toTrainingReadResult } from "./trainingReadResult";
import { useActiveRoutine } from "./useActiveRoutine";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { listSetsFrom } from "../repos/training";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { TrainingSet } from "../repos/trainingSchemas";
import type { MuscleId, MuscleState } from "@keylow/core/training";

/**
 * Each muscle's heat, ready time, weekly sets and volume status at `now`, an ISO timestamp with a zone.
 *
 * What is cached is rows. The sets are read from the day 15 days before today in the user's profile
 * time zone through today, and held under `keys.training.sets(startDay)`, a key of a day and never of
 * `now`, so it is the same all day and a cache restored on a phone is found again. Core's `muscleState`
 * runs in `select`, so the numbers are worked out at the `now` given, from whatever rows are cached,
 * online or not. The muscles the active routine trains are targeted (`targetedMuscles`), and any other
 * that has not reached its MEV is `not_targeted`. The routine is read through `useActiveRoutine`, which
 * `useWeekComparison` shares. Goal priorities join `targetedMuscles` when the goal read exists.
 *
 * The result is pending until the time zone, the routine and the sets are all there, so a muscle is
 * never shown under that the routine does not train. A user with no profile row stays pending, since
 * there is no zone to read days in. `enabled` false makes no request at all. `now` that is not an ISO
 * timestamp with a zone throws a `RangeError`. Every signed-in user has a profile row in KeyLow, so
 * waiting for the zone is waiting for a read that resolves.
 *
 * When no sets are cached under today's start day (an app restored on a later day, with no connection),
 * the newest cached rows under any start day stand in until today's are read, and `select` still works
 * the heat out at `now`.
 */
export function useMuscleState(
  now: string,
  { enabled = true }: DiaryReadOptions = {},
): TrainingReadResult<Record<MuscleId, MuscleState>> {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const timeZone = useProfileTimeZone({ enabled });
  const routine = useActiveRoutine({ enabled });

  const today = timeZone.data ? toLocalDate(new Date(now), timeZone.data) : null;
  const startDay = today === null ? "" : addCalendarDays(today, -HEAT_LOOKBACK_DAYS);
  const activeRoutine = routine.data;

  const select = useCallback(
    (sets: TrainingSet[]) =>
      muscleState(
        sets,
        now,
        TRAINING_PARAMS_V1,
        targetedMuscles({ routine: activeRoutine ?? null }),
      ),
    [now, activeRoutine],
  );

  // Until today's rows are there, the newest rows held under another start day stand in (a cache restored
  // on a later day than it was read). Not before the routine is known, so no muscle flashes as under.
  const standInRows = useCallback(
    () => (activeRoutine === undefined ? undefined : newestCachedSetRows(queryClient)),
    [queryClient, activeRoutine],
  );

  const sets = useQuery({
    queryKey: keys.training.sets(startDay),
    queryFn:
      today === null || activeRoutine === undefined
        ? skipToken
        : () => listSetsFrom(client, startDay, today),
    enabled,
    select,
    placeholderData: standInRows,
  });

  return toTrainingReadResult(sets, [timeZone, routine], [timeZone, routine]);
}
