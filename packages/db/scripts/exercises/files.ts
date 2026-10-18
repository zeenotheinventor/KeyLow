// Where the exercise library's files live, relative to packages/db.
export const EXERCISE_FILES = {
  source: "data/exercises/upstream/free-exercise-db.exercises.json",
  overrides: "data/exercises/overrides.csv",
  curated: "data/exercises/exercises.curated.csv",
  excluded: "data/exercises/exercises.excluded.csv",
} as const;
