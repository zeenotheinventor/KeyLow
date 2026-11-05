import { describeExerciseTarget } from "@keylow/core/copy";

import type { AddedExercise, ScreenSet, SessionViewExercise } from "./sessionViewTypes";
import type { ActiveRoutine, RoutineDetail } from "../repos";
import type { AcceptedExercise, SessionExercise, SessionScaffold } from "@keylow/core/training";

type RoutineDay = RoutineDetail["days"][number];

/**
 * What the session plans: its scaffold, and the routine day it follows. The day is null for a free session
 * that an accepted suggestion pre-fills, which plans the suggested exercises alone.
 */
export type SessionPlan = { day: RoutineDay | null; scaffold: SessionScaffold };

/** The snapshot of the first set of the exercise that the database holds. A set still being saved has none yet. */
const firstSavedSnapshot = (exercise: SessionExercise<ScreenSet>) =>
  exercise.rows.flatMap(({ set }) => (set?.snapshot === undefined ? [] : [set.snapshot]))[0];

/**
 * The exercise's muscle map as the device already holds it: the snapshot of a set the database holds (the
 * map this session's sets count with), else the active routine's current map from any of its days, else
 * the map frozen with an exercise the accepted suggestion added, else null for an exercise added on screen
 * with no set saved yet.
 */
export function describeMuscles(
  exercise: SessionExercise<ScreenSet>,
  routine: ActiveRoutine | null | undefined,
  additions: readonly AcceptedExercise[] = [],
): SessionViewExercise["muscles"] {
  return (
    firstSavedSnapshot(exercise)?.muscles ??
    routine?.days
      .flatMap((day) => day.exercises)
      .find((entry) => entry.exercise_id === exercise.exerciseId)?.muscles ??
    additions.find((entry) => entry.exercise_id === exercise.exerciseId)?.muscles ??
    null
  );
}

/**
 * The exercise's name and target line, from the routine day when it plans the exercise, from the accepted
 * suggestion that added it when it does not (its sets, rep range and RIR, which stay on the card once a set
 * is logged), from the name and equipment frozen on its first logged set when neither does and, for an
 * exercise added on screen with no set yet, from what was picked. Null for an exercise with none of these,
 * which the rows never produce: a row is planned, accepted, logged or added.
 */
export function describeSessionExercise(
  exercise: SessionExercise<ScreenSet>,
  plan: SessionPlan | null,
  added: readonly AddedExercise[],
  additions: readonly AcceptedExercise[] = [],
): Pick<SessionViewExercise, "name" | "target" | "plan"> | null {
  const planned = plan?.day?.exercises.find((entry) => entry.exercise_id === exercise.exerciseId);
  const slots =
    plan?.scaffold.exercises
      .filter((entry) => entry.exercise_id === exercise.exerciseId)
      .reduce((total, entry) => total + entry.slots, 0) ?? 0;
  if (plan !== null && planned !== undefined) {
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
  const addition = additions.find((entry) => entry.exercise_id === exercise.exerciseId);
  if (addition !== undefined) {
    const { rep_min: repMin, rep_max: repMax } = addition;
    const exercisePlan =
      repMin === undefined || repMax === undefined
        ? null
        : { sets: slots, repMin, repMax, rir: addition.target_rir };
    return {
      name: addition.exercise.name,
      target: describeExerciseTarget({
        target: exercisePlan,
        equipment: addition.exercise.equipment,
      }),
      plan: exercisePlan,
    };
  }
  // A set still being saved has no snapshot yet, so the name is read from a set the database holds.
  const snapshot = firstSavedSnapshot(exercise);
  if (snapshot !== undefined) {
    return {
      name: snapshot.name,
      target: describeExerciseTarget({ target: null, equipment: snapshot.equipment }),
      plan: null,
    };
  }
  // An exercise added on screen whose first set is still being saved has no snapshot either.
  const addedExercise = added.find((entry) => entry.id === exercise.exerciseId);
  return addedExercise === undefined
    ? null
    : {
        name: addedExercise.name,
        target: describeExerciseTarget({ target: null, equipment: addedExercise.equipment }),
        plan: null,
      };
}
