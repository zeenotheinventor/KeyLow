import type { SourceExercise } from "../../scripts/exercises/sourceExercise";

/** A strength exercise in free-exercise-db's shape; each test sets only the fields it is about. */
export const sourceExercise = (
  fields: Partial<SourceExercise> & Pick<SourceExercise, "name">,
): SourceExercise => ({
  id: fields.name.replaceAll(" ", "_"),
  category: "strength",
  equipment: "barbell",
  mechanic: "compound",
  force: "push",
  primaryMuscles: [],
  secondaryMuscles: [],
  instructions: [`Perform the ${fields.name}.`],
  ...fields,
});

/** The JSON text of a source file holding these exercises, with the fields the parser checks. */
export const sourceJson = (exercises: readonly SourceExercise[]): string =>
  JSON.stringify(
    exercises.map((exercise) => ({ ...exercise, level: "beginner", images: [] })),
    null,
    2,
  );
