import { describeExerciseTarget } from "@keylow/core/copy";

import type { AddedExercise, ScreenSet, SessionViewExercise } from "./sessionViewTypes";
import type { ActiveRoutine, RoutineDetail } from "../repos";
import type { SessionExercise, SessionScaffold } from "@keylow/core/training";

type RoutineDay = RoutineDetail["days"][number];

/** The routine day the session follows, with its scaffold. */
export type SessionPlan = { day: RoutineDay; scaffold: SessionScaffold };

/** The snapshot of the first set of the exercise that the database holds. A set still being saved has none yet. */
const firstSavedSnapshot = (exercise: SessionExercise<ScreenSet>) =>
  exercise.rows.flatMap(({ set }) => (set?.snapshot === undefined ? [] : [set.snapshot]))[0];

/**
 * The exercise's muscle map as the device already holds it: the snapshot of a set the database holds (the
 * map this session's sets count with), else the active routine's current map from any of its days, else
 * null for an exercise added on screen with no set saved yet.
 */
export function describeMuscles(
  exercise: SessionExercise<ScreenSet>,
  routine: ActiveRoutine | null | undefined,
): SessionViewExercise["muscles"] {
  return (
    firstSavedSnapshot(exercise)?.muscles ??
    routine?.days
      .flatMap((day) => day.exercises)
      .find((entry) => entry.exercise_id === exercise.exerciseId)?.muscles ??
    null
  );
}

/**
 * The exercise's name and target line, from the routine day when it plans the exercise, from the name and
 * equipment frozen on its first logged set when it does not and, for an exercise added on screen with no
 * set yet, from what was picked. Null for an exercise with none of these, which the rows never produce: a
 * row is planned, logged or added.
 */
export function describeSessionExercise(
  exercise: SessionExercise<ScreenSet>,
  plan: SessionPlan | null,
  added: readonly AddedExercise[],
): Pick<SessionViewExercise, "name" | "target" | "plan"> | null {
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
