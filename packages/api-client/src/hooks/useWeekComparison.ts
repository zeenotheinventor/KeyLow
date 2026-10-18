import { COMPARE_PARAMS_V1, compareWeek, projectWeek } from "@keylow/core/training";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { useActiveRoutine } from "./useActiveRoutine";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { listWeekSessions } from "../repos/training";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { WeekSession } from "../repos/trainingSchemas";
import type { MuscleId, MusclePlanComparison, PlanRoutine } from "@keylow/core/training";

const NO_ROUTINE: PlanRoutine = { days: [] };

/**
 * For the week that starts on the Monday `weekStart` (`YYYY-MM-DD`), each muscle's effort-weighted sets
 * logged against the sets the plan projects, the gap between them, and whether the user is `behind`,
 * `on_plan` or `ahead` (core's `compareWeek`). The week is Monday to Sunday by the local date of each
 * session. A logged session of a routine day replaces that day's planned sets, and a session with no
 * day of the active routine counts as logged only. A user with no active routine is compared with an
 * empty plan, so what they logged shows as ahead. The key is the week and never the time, so a cache
 * restored on any later day still has it, and a different week's rows never stand in for this one.
 *
 * What is cached is rows: the week's live sessions, each with its live sets, under
 * `keys.training.weekSessions(weekStart)`. `projectWeek` and `compareWeek` run in `select`, over those
 * rows and the active routine (`useActiveRoutine`, which `useMuscleState` shares), so the comparison is
 * worked out at read time, online or not. The result is pending until the time zone, the routine and
 * the sessions are all there. `enabled` false makes no request at all. A date that is not a Monday
 * fails without a request, as an error that is not retried.
 */
export function useWeekComparison(
  weekStart: string,
  { enabled = true }: DiaryReadOptions = {},
): TrainingReadResult<Record<MuscleId, MusclePlanComparison>> {
  const client = useSupabase();
  const timeZone = useProfileTimeZone({ enabled });
  const routine = useActiveRoutine({ enabled });

  const zone = timeZone.data;
  const activeRoutine = routine.data;

  const select = useCallback(
    (sessions: WeekSession[]) => {
      // The zone only places the planned sets in time, and the comparison counts every set of the
      // week whatever its time, so UTC while a restored cache waits for the zone gives the same numbers.
      const { actual, projected } = projectWeek(
        activeRoutine ?? NO_ROUTINE,
        weekStart,
        zone ?? "UTC",
        { sessions, sets: sessions.flatMap((session) => session.sets) },
        COMPARE_PARAMS_V1,
      );
      return compareWeek(actual, projected, COMPARE_PARAMS_V1);
    },
    [weekStart, zone, activeRoutine],
  );

  const sessions = useQuery<WeekSession[], Error, Record<MuscleId, MusclePlanComparison>>({
    queryKey: keys.training.weekSessions(weekStart),
    queryFn:
      zone && activeRoutine !== undefined ? () => listWeekSessions(client, weekStart) : skipToken,
    enabled,
    select,
    retry: retryUnlessRangeError,
  });

  return toTrainingReadResult(sessions, [timeZone, routine], [routine]);
}
