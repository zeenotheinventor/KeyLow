import * as copy from "../../../src/copy";

import type { CustomExerciseRule } from "../../../src/training";

// Every function `src/copy/sessionExercise.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
const rules: readonly CustomExerciseRule[] = [
  "name_blank",
  "name_too_long",
  "equipment_invalid",
  "muscles_none",
  "muscles_too_many",
  "muscle_unknown",
  "muscle_role_invalid",
  "muscle_repeated",
  "primary_missing",
];

export const samples: Record<string, () => string[]> = {
  describeExerciseGroupHeading: () => [
    copy.describeExerciseGroupHeading("yours", 1),
    copy.describeExerciseGroupHeading("library", 4),
  ],
  describeAddExerciseName: () => [copy.describeAddExerciseName("Side lateral raise")],
  describeCreateExerciseRow: () =>
    ["lateral raise", "  "].flatMap((query) =>
      Object.values(copy.describeCreateExerciseRow(query)),
    ),
  describeExerciseNameLength: () =>
    ["", "Lean-away cable raise"].map(copy.describeExerciseNameLength),
  describeMuscleRowNames: () => Object.values(copy.describeMuscleRowNames("Side delts")),
  describeSaveCustomExerciseAction: () => [
    copy.describeSaveCustomExerciseAction({ kind: "session", dayName: "Legs" }),
    copy.describeSaveCustomExerciseAction({ kind: "session", dayName: null }),
    copy.describeSaveCustomExerciseAction({ kind: "routine" }),
  ],
  describeCustomExerciseIssue: () =>
    rules.map((rule) => copy.describeCustomExerciseIssue({ field: "name", rule })),
};
