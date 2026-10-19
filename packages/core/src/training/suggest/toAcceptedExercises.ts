import { buildSetSnapshot } from "../buildSetSnapshot";

import type { SetSnapshot } from "../../schemas/training";
import type { PlanExercise } from "../expandPlan";
import type { SuggestExercise, Suggestion } from "./suggestTypes";

/**
 * An exercise of a suggestion the user accepted: shaped like a planned exercise, so the projection counts
 * it as one, with the set snapshot frozen from the library entry. `id` is the exercise's own id (it is
 * unique in a day) and `position` its place in the suggested day, after the planned exercises.
 */
export type AcceptedExercise = PlanExercise & Readonly<{ snapshot: SetSnapshot }>;

/**
 * The exercises a suggestion added, as entries a later ticket stores and the projection
 * counts. The planned exercises it kept are not included: they are the plan's already.
 *
 * Throws a `RangeError` when the library lacks a suggested exercise (the message states the rule and holds
 * no value), or when its muscle map breaks a rule of the set snapshot (the message is the snapshot
 * schema's own).
 */
export const toAcceptedExercises = (
  suggestion: Suggestion,
  library: readonly SuggestExercise[],
): AcceptedExercise[] => {
  if (suggestion.kind === "nothing") {
    return [];
  }
  return suggestion.exercises.flatMap((entry, position) => {
    if (entry.origin === "plan") {
      return [];
    }
    const exercise = library.find((each) => each.id === entry.exercise_id);
    if (exercise === undefined) {
      throw new RangeError("A suggested exercise must be in the library");
    }
    const { id, name, equipment, mechanic, muscles } = exercise;
    return [
      {
        id,
        position,
        exercise_id: id,
        target_sets: entry.sets,
        target_rir: entry.target_rir,
        exercise: { id, name, equipment, mechanic },
        muscles,
        snapshot: buildSetSnapshot({ id, name, equipment, mechanic }, muscles),
      },
    ];
  });
};
