import { describe, expect, it } from "vitest";

import { MUSCLE_IDS } from "../../../scripts/exercises/muscles";
import { adminClient } from "../support/stack";

// Each muscle of the list has to be trained as the primary muscle by at least one live global
// exercise, or its region of the body map could never be filled by a logged set. This reads what the
// seed (supabase/seeds/40_exercises.sql) or the import left in the database. It counts the primary
// map rows of live global exercises, so the exercises of other tests and a user's own do not count.

const loadLibraryMessage =
  "load seeds/40_exercises.sql as docs/runbooks/local-dev.md says, or run pnpm --filter @keylow/db import:exercises";

describe("the exercise library in the database", () => {
  it.each(MUSCLE_IDS)(
    "should have a live global exercise with %s as its primary muscle",
    async (muscleId) => {
      const { count, error } = await adminClient()
        .from("exercise_muscles")
        .select("exercise_id, exercises!inner(owner_id, deleted_at)", {
          count: "exact",
          head: true,
        })
        .eq("muscle_id", muscleId)
        .eq("role", "primary")
        .is("exercises.owner_id", null)
        .is("exercises.deleted_at", null);

      expect(error).toBeNull();
      expect(count, loadLibraryMessage).toBeGreaterThanOrEqual(1);
    },
  );
});
