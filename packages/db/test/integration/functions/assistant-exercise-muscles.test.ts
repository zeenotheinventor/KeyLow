import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getExercise } from "../../../../api-client/src/repos/exercises";
import { archiveExercise } from "../../../../api-client/src/repos/exerciseWrites";
import {
  findGlobalExercise,
  saveExercise,
} from "../../../../api-client/test/integration/support/training";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { SavedExercise } from "../../../../api-client/test/integration/support/training";
import type { TestUser } from "../support/users";

/*
 * The read behind `show_exercise_muscles` against the real tables, with two users. HTTP-free, like the other
 * training tools' files: each read runs with the user's own signed-in client, which is the client the `mcp`
 * function hands a tool as its caller, so row level security scopes it. It proves the tool's `not_found`:
 * another person's custom exercise and an archived one both read as nothing, the same as an id that does not
 * exist, and an own custom exercise and a library one answer with their muscles. The tool's own tests run
 * under Deno with a stub client and assert the words and the figure. Each user's exercise has a name of its
 * own, and nothing here resets the stack.
 */

const ALICE_MUSCLES = [
  { muscle_id: "delt_rear", role: "primary", weight: 1 },
  { muscle_id: "traps_mid", role: "secondary", weight: 0.5 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
] as const;

let alice: TestUser;
let bob: TestUser;
let aliceExercise: SavedExercise;
let bobExercise: SavedExercise;
let aliceArchived: SavedExercise;
let libraryExercise: SavedExercise;

beforeAll(async () => {
  [alice, bob] = await Promise.all([createTestUser("key924-alice"), createTestUser("key924-bob")]);
  [aliceExercise, aliceArchived, bobExercise, libraryExercise] = await Promise.all([
    saveExercise(alice, "muscles-own", [...ALICE_MUSCLES]),
    saveExercise(alice, "muscles-archived"),
    saveExercise(bob, "muscles-bob"),
    findGlobalExercise(),
  ]);
  await archiveExercise(alice.client, aliceArchived.id);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("show_exercise_muscles", () => {
  it("reads the caller's own custom exercise with its muscles and roles, a stabiliser too", async () => {
    const exercise = await getExercise(alice.client, aliceExercise.id);

    expect(exercise?.name).toBe(aliceExercise.name);
    expect(exercise?.muscles.map(({ muscle_id, role }) => ({ muscle_id, role }))).toEqual([
      { muscle_id: "delt_rear", role: "primary" },
      { muscle_id: "traps_mid", role: "secondary" },
      { muscle_id: "calves", role: "stabiliser" },
    ]);
  });

  it("reads another user's custom exercise as nothing, the same as an id that does not exist", async () => {
    const missingExerciseId = "00000000-0000-4000-8000-000000000000";

    expect(await getExercise(bob.client, aliceExercise.id)).toBeNull();
    expect(await getExercise(alice.client, bobExercise.id)).toBeNull();
    expect(await getExercise(bob.client, missingExerciseId)).toBeNull();
  });

  it("reads an archived exercise as nothing, even for its owner", async () => {
    expect(await getExercise(alice.client, aliceArchived.id)).toBeNull();
  });

  it("reads a library exercise for either user, with at least one muscle", async () => {
    for (const user of [alice, bob]) {
      const exercise = await getExercise(user.client, libraryExercise.id);

      expect(exercise?.name).toBe(libraryExercise.name);
      expect(exercise?.muscles.length).toBeGreaterThan(0);
    }
  });
});
