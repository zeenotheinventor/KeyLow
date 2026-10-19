import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { EXERCISE_FILES } from "../../../scripts/exercises/files";
import { MUSCLE_IDS } from "../../../scripts/exercises/muscles";
import { readCuratedExercises } from "../../../scripts/exercises/readCuratedExercises";
import { adminClient } from "../support/stack";

// Each muscle of the list has to be trained as the primary muscle by at least one live global
// exercise, or its region of the body map could never be filled by a logged set. This reads what the
// migration (supabase/migrations/*_exercise_library.sql) or the import left in the database. It counts
// the primary map rows of live global exercises, so a user's own exercises and the key349- exercises
// that the import tests keep while they run do not count.

// The import run that supabase/migrations/*_exercise_library.sql writes (EXERCISE_MIGRATION_RUN_ID).
const migrationImportRunId = "e1b00000-0000-4000-8000-000000000001";

const curatedExerciseCount = readCuratedExercises(
  readFileSync(new URL(`../../../${EXERCISE_FILES.curated}`, import.meta.url), "utf8"),
).length;

const loadLibraryMessage =
  "apply the migrations (pnpm --filter @keylow/db db:reset) as docs/runbooks/local-dev.md says, or run pnpm --filter @keylow/db import:exercises";

describe("the exercise library in the database", () => {
  it.each(MUSCLE_IDS)(
    "should have a live global exercise with %s as its primary muscle",
    async (muscleId) => {
      const { count, error } = await adminClient()
        .from("exercise_muscles")
        .select("exercise_id, exercises!inner(owner_id, deleted_at, source_ref)", {
          count: "exact",
          head: true,
        })
        .eq("muscle_id", muscleId)
        .eq("role", "primary")
        .is("exercises.owner_id", null)
        .is("exercises.deleted_at", null)
        // Other suites keep live key349- exercises while they run, and those are not the library.
        .not("exercises.source_ref", "like", "key349-%");

      expect(error).toBeNull();
      expect(count, loadLibraryMessage).toBeGreaterThanOrEqual(1);
    },
  );

  it("should hold as many live global exercises as the curated CSV has rows", async () => {
    const { count, error } = await adminClient()
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("source", "free_exercise_db")
      .is("owner_id", null)
      .is("deleted_at", null)
      // Other suites keep live key349- exercises while they run, and those are not the library.
      .not("source_ref", "like", "key349-%");

    expect(error).toBeNull();
    expect(count, loadLibraryMessage).toBe(curatedExerciseCount);
  });

  it("should record the migration's import run", async () => {
    const { data, error } = await adminClient()
      .from("exercise_import_runs")
      .select("id")
      .eq("id", migrationImportRunId);

    expect(error).toBeNull();
    expect(data, loadLibraryMessage).toEqual([{ id: migrationImportRunId }]);
  });
});
