import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V2, muscleState } from "@keylow/core/training";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { HEAT_LOOKBACK_DAYS, newestCachedSetRows } from "./heatWindowRows";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { toTrainingReadResult } from "./trainingReadResult";
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
 * online or not. The plan does not change a volume status (ADR 0005, Amendment 6), so the hook reads no
 * routine and no goal.
 *
 * The result is pending until the time zone and the sets are there. A user with no profile row stays
 * pending, since there is no zone to read days in. `enabled` false makes no request at all. `now` that is
 * not an ISO timestamp with a zone throws a `RangeError`. Every signed-in user has a profile row in KeyLow,
 * so waiting for the zone is waiting for a read that resolves.
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

  const today = timeZone.data ? toLocalDate(new Date(now), timeZone.data) : null;
  const startDay = today === null ? "" : addCalendarDays(today, -HEAT_LOOKBACK_DAYS);

  const select = useCallback(
    (sets: TrainingSet[]) => muscleState(sets, now, TRAINING_PARAMS_V2),
    [now],
  );

  // Until today's rows are there, the newest rows held under another start day stand in (a cache restored
  // on a later day than it was read).
  const standInRows = useCallback(() => newestCachedSetRows(queryClient), [queryClient]);

  const sets = useQuery({
    queryKey: keys.training.sets(startDay),
    queryFn: today === null ? skipToken : () => listSetsFrom(client, startDay, today),
    enabled,
    select,
    placeholderData: standInRows,
  });

  return toTrainingReadResult(sets, [timeZone], [timeZone]);
}
