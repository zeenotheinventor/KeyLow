import { pushPullLegsDraft } from "./routineEditorFixtures";

import type { ExerciseNames } from "../../components/RoutineEditor";

// The names of the golden Push Pull Legs' exercises (KEY-353), in the order the draft lists them: Push,
// Pull, Legs, then Push again.
const pushNames = [
  "Barbell bench press",
  "Incline dumbbell press",
  "Seated barbell military press",
  "Side lateral raise",
  "Triceps pushdown",
];
const pullNames = ["Barbell row", "Lat pulldown", "Seated cable row", "Face pull", "Dumbbell curl"];
const legsNames = [
  "Barbell squat",
  "Romanian deadlift",
  "Leg press",
  "Seated leg curl",
  "Standing calf raise",
];

const namesInDraftOrder = [...pushNames, ...pullNames, ...legsNames, ...pushNames];

/** The names of `pushPullLegsDraft`'s exercises, by exercise id. */
export const pushPullLegsExerciseNames: ExerciseNames = Object.fromEntries(
  pushPullLegsDraft.days
    .flatMap((day) => day.exercises)
    .map((exercise, position) => [exercise.exercise_id, namesInDraftOrder[position] ?? ""]),
);
