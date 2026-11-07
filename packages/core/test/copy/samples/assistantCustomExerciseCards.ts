import * as copy from "../../../src/copy";

// Every function the custom exercise block of `src/copy/assistantTrainingCards.ts` exports, called with
// representative arguments. The voice test fails when a function has no row, so no sentence escapes the sweep.
const abs = { muscle_id: "abs", role: "primary" } as const;
const obliques = { muscle_id: "obliques", role: "secondary" } as const;

export const samples: Record<string, () => string[]> = {
  describeExerciseMuscles: () => [copy.describeExerciseMuscles([abs, obliques])],
  describeExerciseCreatedSub: () => [copy.describeExerciseCreatedSub("cable", [abs])],
  describeExerciseCreatedTitle: () => [copy.describeExerciseCreatedTitle("Cable crunch")],
  describeExerciseCreatedUndone: () => [copy.describeExerciseCreatedUndone("Cable crunch")],
  describeExerciseUpdatedTitle: () => [copy.describeExerciseUpdatedTitle("Kneeling cable crunch")],
  describeExerciseWasName: () => [copy.describeExerciseWasName("Cable crunch")],
  describeExerciseEquipmentChange: () => [copy.describeExerciseEquipmentChange("machine", "cable")],
  describeExerciseMusclesChange: () => [copy.describeExerciseMusclesChange([abs, obliques], [abs])],
  describeExerciseUpdatedUndone: () => [
    copy.describeExerciseUpdatedUndone("Cable crunch", "cable", [abs]),
    copy.describeExerciseUpdatedUndone("Cable crunch", "dumbbell", [abs]),
  ],
  describeExerciseArchivedTitle: () => [copy.describeExerciseArchivedTitle("Cable crunch")],
  describeExerciseArchivedUndone: () => [copy.describeExerciseArchivedUndone("Cable crunch")],
  describeConfirmArchiveExerciseQuestion: () => [
    copy.describeConfirmArchiveExerciseQuestion("Cable crunch"),
  ],
};
