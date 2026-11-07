import { afterAll, describe, expect, it } from "vitest";

import { saveExercise } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { acceptSuggestion, undoAcceptedSuggestion } from "../../src/repos/acceptedSuggestions";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { SuggestedSession, SuggestExercise } from "@keylow/core/training";

// The assistant's `archive_custom_exercise` and the Undo of `save_custom_exercise` ask whether a live accepted
// suggestion names an exercise, with a jsonb containment filter on `accepted_suggestions.exercises`. A real
// server refuses a filter built from an array (the client writes it as a Postgres array literal), and only a
// string works. This sends the same filter to the real table. The user is new for the run and its rows go
// with it. Every name is key905- plus a random suffix.

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const MUSCLES: ExerciseMuscleEntry[] = [
  { muscle_id: "abs", role: "primary", weight: 1 },
  { muscle_id: "obliques", role: "secondary", weight: 0.5 },
];

const DAY = "2026-10-15";

const suggestionOf = (exercise: SavedExercise): SuggestedSession => ({
  kind: "session",
  exercises: [
    {
      exercise_id: exercise.id,
      sets: 3,
      rep_min: 8,
      rep_max: 10,
      target_rir: 2,
      origin: "added",
      reasons: [
        {
          muscle_id: "abs",
          priority: 3,
          weekly_sets: 1.5,
          logged_sets: 1.5,
          mav_low: 10,
          heat: 0.25,
          score: 18.79,
        },
      ],
    },
  ],
  sets: 3,
  minutes: 15,
  skipped: [],
  no_room: null,
});

const libraryOf = (exercise: SavedExercise): SuggestExercise[] => [
  {
    id: exercise.id,
    name: exercise.name,
    equipment: "barbell",
    mechanic: "compound",
    muscles: MUSCLES,
  },
];

// The filter `isOnAcceptedSuggestion` in `packages/db/supabase/functions/_shared/assistant/tools/exerciseWrite.ts`
// sends, which runs under Deno and cannot be imported here. Keep the two the same.
const suggestionsNaming = async (user: TestUser, exerciseId: string) => {
  const { data, error } = await user.client
    .from("accepted_suggestions")
    .select("id")
    .is("deleted_at", null)
    .gte("local_date", DAY)
    .contains("exercises", JSON.stringify([{ exercise_id: exerciseId }]))
    .limit(1);
  expect(error).toBeNull();
  return data ?? [];
};

describe("the accepted suggestion filter of the custom exercise tools", () => {
  it("should find the live suggestion for its exercise and not for another", async () => {
    const owner = await createTestUser("key905");
    const named = await saveExercise(owner, "named", MUSCLES);
    const other = await saveExercise(owner, "other", MUSCLES);
    const stored = await acceptSuggestion(owner.client, {
      suggestion: suggestionOf(named),
      library: libraryOf(named),
      localDate: DAY,
      routineDayId: null,
    });

    expect((await suggestionsNaming(owner, named.id)).map(({ id }) => id)).toEqual([stored.id]);
    expect(await suggestionsNaming(owner, other.id)).toEqual([]);
  });

  it("should not find a suggestion that was undone", async () => {
    const owner = await createTestUser("key905");
    const named = await saveExercise(owner, "named", MUSCLES);
    const stored = await acceptSuggestion(owner.client, {
      suggestion: suggestionOf(named),
      library: libraryOf(named),
      localDate: DAY,
      routineDayId: null,
    });
    await undoAcceptedSuggestion(owner.client, stored.id);

    expect(await suggestionsNaming(owner, named.id)).toEqual([]);
  });
});
