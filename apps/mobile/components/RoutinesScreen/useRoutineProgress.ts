import {
  useProfileTimeZone,
  useRoutine,
  useRoutineTrendSets,
  useWeightUnit,
} from "@keylow/api-client";
import { describeProgressRow } from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import { routineTrendsByDay, trendSeries } from "@keylow/core/training";
import { useMemo } from "react";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { RoutineProgressState } from "../RoutineProgressDay";

/** The range the Progress section works each exercise's trend over: 3 months. */
const PROGRESS_RANGE = "3m";

/** How many of the latest weeks the sparkline draws. */
const SPARKLINE_WEEKS = 8;

/**
 * The progress of every exercise of a routine, by routine day, from the routine and one read of its sets
 * (`useRoutineTrendSets`), with the trend worked out here at read time over the last 3 months. Loads are
 * shown in the profile's unit. All the reads are kept on the phone, so it opens without a connection. It
 * is loading until every read is in, and fails, with a retry for the reads that failed, only when there is
 * nothing to show yet. No routine id, as when no routine is active, makes no request and is `ready` with
 * no days. A routine that is not there has no days either. Nothing here logs or reports a name or a number.
 */
export function useRoutineProgress(routineId: string | undefined): RoutineProgressState {
  const enabled = useReadsEnabled();
  const now = useNow().toISOString();
  const routine = useRoutine(routineId, { enabled });
  const sets = useRoutineTrendSets(routineId, PROGRESS_RANGE, { now, enabled });
  const unit = useWeightUnit({ enabled });
  const timeZone = useProfileTimeZone({ enabled });

  // The trend only moves when the week does, so the clock's tick every minute must not rebuild every row and
  // redraw every sparkline. The rows are worked out from the Monday of this week, which is all `now` gives them.
  const zone = timeZone.data === undefined ? undefined : (timeZone.data ?? "UTC");
  const today = zone === undefined ? undefined : toLocalDate(new Date(now), zone);
  const currentWeek =
    today === undefined ? undefined : addCalendarDays(today, -daysSinceMonday(today));
  const routineData = routine.data;
  const setsData = sets.data;
  const unitData = unit.data;
  const days = useMemo(() => {
    if (
      !routineData ||
      setsData === undefined ||
      unitData === undefined ||
      zone === undefined ||
      currentWeek === undefined
    ) {
      return [];
    }
    return routineTrendsByDay(
      routineData.days,
      { sets: setsData.sets, earlier: setsData.earlier },
      { range: PROGRESS_RANGE, now: `${currentWeek}T12:00:00Z`, timeZone: zone },
    )
      .map(({ id, name, exercises }) => ({
        id,
        name,
        exercises: exercises.map(({ exercise, trend }) => ({
          exerciseId: exercise.exercise.id,
          name: exercise.exercise.name,
          points: trendSeries(trend.weeks.slice(-SPARKLINE_WEEKS), unitData).points.map(
            ({ value }) => value,
          ),
          ...describeProgressRow({ name: exercise.exercise.name, trend, unit: unitData }),
        })),
      }))
      .filter(({ exercises }) => exercises.length > 0);
  }, [routineData, setsData, unitData, zone, currentWeek]);

  if (routineId === undefined) {
    return { status: "ready", days: [] };
  }
  if (
    routine.data === undefined ||
    sets.data === undefined ||
    unit.data === undefined ||
    timeZone.data === undefined
  ) {
    const failed = routine.isError || sets.isError || unit.isError || timeZone.isError;
    return failed
      ? {
          status: "error",
          onRetry: () => {
            void Promise.all([
              routine.isError ? routine.refetch() : null,
              sets.refetch(),
              unit.isError ? unit.refetch() : null,
              timeZone.isError ? timeZone.refetch() : null,
            ]);
          },
        }
      : { status: "loading" };
  }

  return { status: "ready", days };
}
