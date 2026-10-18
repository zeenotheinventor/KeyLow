// Where the exercise library's files live, relative to packages/db.
export const EXERCISE_FILES = {
  source: "data/exercises/upstream/free-exercise-db.exercises.json",
  overrides: "data/exercises/overrides.csv",
  curated: "data/exercises/exercises.curated.csv",
  excluded: "data/exercises/exercises.excluded.csv",
} as const;

/** The commit of the free-exercise-db repository that the source file was taken from (VERIFICATION.md, "Provenance"). */
export const SOURCE_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";

/** The seed that `import-exercises.ts --emit-sql` writes, relative to packages/db. */
export const EXERCISE_SEED_FILE = "supabase/seeds/40_exercises.sql";
