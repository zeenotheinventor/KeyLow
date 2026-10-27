import * as copy from "../../../src/copy";

// Every function `src/copy/exerciseMuscles.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeExerciseMusclesButton: () => [copy.describeExerciseMusclesButton("Leg Press")],
  describeRoleRow: () =>
    (["primary", "secondary", "stabiliser"] as const).flatMap((role) => {
      const row = copy.describeRoleRow(role, ["glute_max", "hamstrings"]);
      return [row.muscles, row.role];
    }),
  describeExerciseMusclesFigureLabel: () => [
    copy.describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "front" }),
    copy.describeExerciseMusclesFigureLabel({ name: "Leg Press", side: "back" }),
  ],
};
