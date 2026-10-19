import type { RoutineDraft, RoutineDraftDay } from "@keylow/core/training";

let nextExerciseNumber = 1;

const uuid = (group: number, number: number): string =>
  `${String(group).padStart(8, "0")}-0000-4000-8000-${String(number).padStart(12, "0")}`;

// A day of exercises with the sets given, so a test can reach a day's set count without caring which exercises.
function plannedExercises(sets: readonly number[]): RoutineDraftDay["exercises"] {
  return sets.map((targetSets) => ({
    exercise_id: uuid(1, nextExerciseNumber++),
    target_sets: targetSets,
    rep_min: 8,
    rep_max: 12,
    target_rir: 2,
  }));
}

function day(id: number, name: string, weekday: number, sets: readonly number[]): RoutineDraftDay {
  return { id: uuid(3, id), name, weekday, exercises: plannedExercises(sets) };
}

/** The golden Push Pull Legs (KEY-353) as a draft: Mon Push 16 sets, Tue Pull 15, Thu Legs 16, Sat Push 16, so 63 a week. */
export const pushPullLegsDraft: RoutineDraft = {
  name: "Push Pull Legs",
  days: [
    day(1, "Push", 0, [4, 3, 3, 3, 3]),
    day(2, "Pull", 1, [3, 3, 3, 3, 3]),
    day(3, "Legs", 3, [3, 3, 3, 3, 4]),
    day(4, "Push", 5, [4, 3, 3, 3, 3]),
  ],
};
