import { useActiveRoutine, useActiveSession, useRoutine, useWeightUnit } from "@keylow/api-client";
import { describeExerciseTarget } from "@keylow/core/copy";
import { planProgress, scaffoldSession, sessionExercises } from "@keylow/core/training";
import { useMemo } from "react";

import { NO_PENDING_SETS, withPendingSets } from "./pendingSets";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { PendingSet, ScreenSet, SessionScreenExercise, SessionScreenView } from "./types";
import type { RoutineDetail } from "@keylow/api-client";
import type { SessionExercise, SessionScaffold } from "@keylow/core/training";

type RoutineDay = RoutineDetail["days"][number];
type Plan = { day: RoutineDay; scaffold: SessionScaffold };

/**
 * The exercise's name and target line, from the routine day when it plans the exercise and from the name and
 * equipment frozen on its first logged set when it does not. Null for an exercise with neither, which the
 * rows never produce: a row is planned or logged.
 */
function describeExercise(
  exercise: SessionExercise<ScreenSet>,
  plan: Plan | null,
): Pick<SessionScreenExercise, "name" | "target" | "plan"> | null {
  const planned = plan?.day.exercises.find((entry) => entry.exercise_id === exercise.exerciseId);
  if (plan !== null && planned !== undefined) {
    const slots = plan.scaffold.exercises
      .filter((entry) => entry.exercise_id === exercise.exerciseId)
      .reduce((total, entry) => total + entry.slots, 0);
    const exercisePlan = {
      sets: slots,
      repMin: planned.rep_min,
      repMax: planned.rep_max,
      rir: planned.target_rir,
    };
    return {
      name: planned.exercise.name,
      target: describeExerciseTarget({
        target: exercisePlan,
        equipment: planned.exercise.equipment,
      }),
      plan: exercisePlan,
    };
  }
  // A set still being saved has no snapshot yet, so the name is read from a set the database holds.
  const snapshot = exercise.rows.flatMap(({ set }) =>
    set?.snapshot === undefined ? [] : [set.snapshot],
  )[0];
  return snapshot === undefined
    ? null
    : {
        name: snapshot.name,
        target: describeExerciseTarget({ target: null, equipment: snapshot.equipment }),
        plan: null,
      };
}

/**
 * What the active session screen shows, from the reads it waits on: the session in progress, the profile's
 * unit and, for a session that follows a routine day, the active routine and its detail (the day's rep
 * ranges). Every read waits until the account has accepted the current Terms, and each is saved on the
 * phone, so the screen opens offline. A session with no routine day does not wait on or fail with the
 * routine reads. A session whose day is not in the active routine (it was changed since), or whose routine
 * cannot be read because the phone is offline and has it not saved, is shown as a session with no plan.
 * The rows are worked out again only when the session, the routine or the sets being saved change, never on
 * the header's tick. The sets being saved are drawn as logged, so the header and the rows move at the press.
 */
export function useSessionScreen(
  pendingSets: readonly PendingSet[] = NO_PENDING_SETS,
): SessionScreenView {
  const enabled = useReadsEnabled();
  const session = useActiveSession({ enabled });
  const routine = useActiveRoutine({ enabled });
  const unit = useWeightUnit({ enabled });
  const detail = useRoutine(routine.data?.id, { enabled });

  const open = session.data;
  const followsRoutineDay = open?.routine_day_id !== null && open?.routine_day_id !== undefined;
  const detailData = detail.data;
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
      setsLogged: progress.logged,
      setsPlanned: progress.planned ?? 0,
      exercises: sessionExercises(scaffold, sets).flatMap((exercise) => {
        const described = describeExercise(exercise, plan);
        return described === null ? [] : [{ ...described, exercise }];
      }),
    };
  }, [open, detailData, pendingSets]);

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

  // A read that is paused is waiting for a connection, and the phone does not have it saved: the session is shown without its plan.
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
      setsLogged: content.setsLogged,
      setsPlanned: content.setsPlanned,
    },
    unit: unit.data,
    sets: content.sets,
    exercises: content.exercises,
  };
}
