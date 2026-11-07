import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getExercise } from "../../../../api-client/src/repos/exercises";
import { listTrendSets } from "../../../../api-client/src/repos/trainingTrend";
import {
  logSets,
  saveExercise,
  startSession,
} from "../../../../api-client/test/integration/support/training";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { SavedExercise } from "../../../../api-client/test/integration/support/training";
import type { TestUser } from "../support/users";

/*
 * The reads behind `get_exercise_progress` against the real tables, with two users. HTTP-free, like the other
 * training tools' file: each read runs with the user's own signed-in client, which is the client the `mcp`
 * function hands a tool as its caller, so row level security scopes it. It proves that an exercise one user
 * made, and the sets logged against it, never reach the tool of the other, whose answer for the id is
 * not found (ADR 0006, Amendment 1). The tool's own tests run under Deno with a stub client and assert the
 * weeks, the words and the citation.
 */

const RANGE = { fromWeek: "2026-09-28", throughDay: "2026-10-20" };

let alice: TestUser;
let bob: TestUser;
let aliceExercise: SavedExercise;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser("key892-alice"), createTestUser("key892-bob")]);
  aliceExercise = await saveExercise(alice, "progress");
  const session = await startSession(alice, "2026-10-06");
  await logSets(alice, session, aliceExercise, [
    { performedAt: "2026-10-06T09:00:00Z", loadKg: 60, reps: 8 },
  ]);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("get_exercise_progress", () => {
  it("reads the caller's own custom exercise and its sets", async () => {
    expect((await getExercise(alice.client, aliceExercise.id))?.name).toBe(aliceExercise.name);

    const { sets } = await listTrendSets(alice.client, [aliceExercise.id], RANGE);

    expect(sets.map(({ load_kg, reps }) => ({ load_kg, reps }))).toEqual([
      { load_kg: 60, reps: 8 },
    ]);
  });

  it("reads another user's custom exercise as nothing, the same as an id that does not exist", async () => {
    const missingExerciseId = "00000000-0000-4000-8000-000000000000";

    expect(await getExercise(bob.client, aliceExercise.id)).toBeNull();
    expect(await getExercise(bob.client, missingExerciseId)).toBeNull();
  });

  it("reads no set of another user's exercise", async () => {
    expect(await listTrendSets(bob.client, [aliceExercise.id], RANGE)).toEqual({
      sets: [],
      earlier: [],
    });
  });
});
