import { planProgress, scaffoldSession, sessionExercises } from "@keylow/core/training";
import { useMemo } from "react";

import { describeMuscles, describeSessionExercise } from "./describeSessionExercise";
import { NO_PENDING_SETS, withPendingSets } from "./pendingSets";
import { useActiveRoutine } from "./useActiveRoutine";
import { useActiveSession } from "./useActiveSession";
import { useAddedExercises } from "./useAddedExercises";
import { useRoutine } from "./useRoutine";
import { useWeightUnit } from "./useWeightUnit";

import type { PendingSet, SessionView } from "./sessionViewTypes";

/**
 * What an active session screen shows, from the reads it waits on: the session in progress, the profile's
 * unit and, for a session that follows a routine day, the active routine and its detail (the day's rep
 * ranges). Every read waits until `enabled` (the mobile app passes false until the account has accepted the
 * current Terms), and each is saved on the device, so the screen opens offline. A session with no routine
 * day does not wait on or fail with the routine reads. A session whose day is not in the active routine (it
 * was changed since), or whose routine cannot be read because the device is offline and has it not saved,
 * is shown as a session with no plan. The rows are worked out again only when the session, the routine or
 * the sets being saved change, never on the header's tick. The sets being saved are drawn as logged, so the
 * header and the rows move at the press.
 */
export function useSessionView(
  { enabled }: { enabled: boolean },
  pendingSets: readonly PendingSet[] = NO_PENDING_SETS,
): SessionView {
  const session = useActiveSession({ enabled });
  const routine = useActiveRoutine({ enabled });
  const unit = useWeightUnit({ enabled });
  const detail = useRoutine(routine.data?.id, { enabled });

  const open = session.data;
  const { added, add: addExercise } = useAddedExercises(open?.id);
  const followsRoutineDay = open?.routine_day_id !== null && open?.routine_day_id !== undefined;
  const detailData = detail.data;
  const routineData = routine.data;
  const content = useMemo(() => {
    if (open === null || open === undefined) {
      return null;
    }
    const day = detailData?.days.find((entry) => entry.id === open.routine_day_id) ?? null;
    const scaffold = day === null ? null : scaffoldSession(day);
    const plan = day === null || scaffold === null ? null : { day, scaffold };
    const sets = withPendingSets(open.sets, pendingSets);
    const progress = planProgress(scaffold, sets);
    return {
      sets,
      progress,
      plannedNames:
        plan === null
          ? null
          : plan.day.exercises.map((entry) => ({
              exerciseId: entry.exercise_id,
              name: entry.exercise.name,
            })),
      exercises: sessionExercises(
        scaffold,
        sets,
        added.map((entry) => entry.id),
      ).flatMap((exercise) => {
        const described = describeSessionExercise(exercise, plan, added);
        return described === null
          ? []
          : [{ ...described, muscles: describeMuscles(exercise, routineData), exercise }];
      }),
    };
  }, [open, detailData, routineData, pendingSets, added]);

  const reads = followsRoutineDay ? [session, unit, routine, detail] : [session, unit];
  if (reads.some((read) => read.isError && read.data === undefined)) {
    return {
      status: "error",
      retry: () => {
        for (const read of reads) {
          void read.refetch();
        }
      },
    };
  }

  if (open === null) {
    return { status: "none" };
  }

  // A read that is paused is waiting for a connection, and the device does not have it saved: the session is shown without its plan.
  const isWaitingForRoutine = routine.data === undefined && routine.fetchStatus !== "paused";
  const isWaitingForDetail =
    routine.data !== undefined &&
    routine.data !== null &&
    detail.data === undefined &&
    detail.fetchStatus !== "paused";
  const isWaitingForPlan = followsRoutineDay && (isWaitingForRoutine || isWaitingForDetail);
  if (open === undefined || content === null || unit.data === undefined || isWaitingForPlan) {
    return { status: "loading" };
  }

  return {
    status: "ready",
    sessionId: open.id,
    header: {
      dayName: open.routine_day_name,
      startedAt: open.started_at,
      endedAt: open.ended_at,
      setsLogged: content.progress.logged,
      setsPlanned: content.progress.planned ?? 0,
    },
    unit: unit.data,
    sets: content.sets,
    exercises: content.exercises,
    addExercise,
    progress: content.progress,
    plannedNames: content.plannedNames,
  };
}
