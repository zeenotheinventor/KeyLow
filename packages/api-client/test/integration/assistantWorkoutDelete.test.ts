import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "./support/stack";
import { findGlobalExercise, logSets, present } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import { undoAssistantActions } from "../../src/repos/assistantConversations";
import {
  deleteSession,
  finishSession,
  restoreSession,
  startSession,
} from "../../src/repos/sessionWrites";
import { removeSet } from "../../src/repos/setWrites";
import { readMuscleState } from "../../src/repos/trainingReads";
import { getSession } from "../../src/repos/trainingSessions";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

/*
 * What the assistant's `delete_workout` relies on in the database, with real user JWTs (KEY-907). The tool runs
 * in Deno and cannot be imported here, so the delete is the repo call it makes, the stamp is read back the way
 * the tool reads it, and the action is stored the way the executor stores it. The Undo then runs through the
 * served `assistant` function, which is the tool's own inverse. The point of the file is that the stamp the
 * tool records, which goes through the `assistant_actions` column and back, is the one text that finds the
 * session and exactly its sets again, and that heat counts them again. Rows are named by key907- users.
 */

const admin = adminClient();
let globalExercise: SavedExercise;

beforeAll(async () => {
  globalExercise = await findGlobalExercise();
  await requireServedFunction(inject("stack"), "assistant");
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const startedAt = new Date("2026-10-18T09:00:00Z");
const heatNow = "2026-10-18T10:00:00Z";

/** The session's `deleted_at` exactly as PostgREST answers it, which is the read the tool makes. */
async function deletedAtOf(user: TestUser, sessionId: string): Promise<string> {
  const { data, error } = await user.client
    .from("workout_sessions")
    .select("deleted_at")
    .eq("id", sessionId)
    .maybeSingle();
  expect(error).toBeNull();
  return present(data?.deleted_at, "the delete stamp");
}

/** A finished session of three sets, one removed on its own before the whole is deleted, as the tool leaves it. */
async function deletedWorkout(user: TestUser) {
  const { id } = await startSession(user.client, { now: startedAt, tz: "UTC" });
  const logged = await logSets(user, id, globalExercise, [
    { performedAt: "2026-10-18T09:10:00Z" },
    { performedAt: "2026-10-18T09:20:00Z" },
    { performedAt: "2026-10-18T09:30:00Z" },
  ]);
  const removedEarlier = present(logged[1], "a logged set");
  await finishSession(user.client, id, { endedAt: new Date("2026-10-18T09:45:00Z"), note: null });
  await removeSet(user.client, removedEarlier);
  const keptSetIds = [present(logged[0], "a logged set"), present(logged[2], "a logged set")];
  const heatBefore = await weeklySetsOfChest(user);
  await deleteSession(user.client, id);
  const deletedAt = await deletedAtOf(user, id);
  return { id, keptSetIds, removedEarlier, deletedAt, heatBefore };
}

const weeklySetsOfChest = async (user: TestUser) =>
  (await readMuscleState(user.client, { now: heatNow, timeZone: "UTC" })).chest_lower.weeklySets;

/** The action the executor stores for a `delete_workout`: the session as the target, and the stamp as its time. */
async function storeAction(user: TestUser, sessionId: string, stamp: string): Promise<string> {
  const { data, error } = await admin
    .from("assistant_actions")
    .insert({
      user_id: user.id,
      turn_seq: 1,
      tool: "delete_workout",
      target_table: "workout_sessions",
      target_id: sessionId,
      target_updated_at: stamp,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return present(data?.id, "the action id");
}

describe("delete_workout against the local stack", () => {
  it("should keep the stamp as the database wrote it when it goes through the action row and back", async () => {
    const user = await createTestUser("key907");
    const { id, deletedAt } = await deletedWorkout(user);

    const actionId = await storeAction(user, id, deletedAt);

    const { data, error } = await admin
      .from("assistant_actions")
      .select("target_updated_at")
      .eq("id", actionId)
      .single();
    expect(error).toBeNull();
    // The text the inverse is handed and compares with the session's own `deleted_at`.
    expect(data?.target_updated_at).toBe(deletedAt);
  });

  it("should bring back the session and exactly its sets through Undo, leave an earlier removed set removed, and count them in heat again", async () => {
    const user = await createTestUser("key907");
    const { id, keptSetIds, removedEarlier, deletedAt, heatBefore } = await deletedWorkout(user);
    const actionId = await storeAction(user, id, deletedAt);
    expect(await getSession(user.client, id)).toBeNull();
    expect(await weeklySetsOfChest(user)).toBe(0);

    const results = await undoAssistantActions(user.client, [actionId]);

    expect(results).toEqual([{ actionId, result: "undone" }]);
    const restored = await getSession(user.client, id);
    expect(restored?.sets.map((set) => set.id).sort()).toEqual([...keptSetIds].sort());
    expect(restored?.sets.map((set) => set.id)).not.toContain(removedEarlier);
    expect(heatBefore).toBeGreaterThan(0);
    expect(await weeklySetsOfChest(user)).toBe(heatBefore);
  });

  it("should answer already_undone on a second press and change nothing", async () => {
    const user = await createTestUser("key907");
    const { id, keptSetIds, deletedAt } = await deletedWorkout(user);
    const actionId = await storeAction(user, id, deletedAt);
    await undoAssistantActions(user.client, [actionId]);

    const results = await undoAssistantActions(user.client, [actionId]);

    expect(results).toEqual([{ actionId, result: "already_undone" }]);
    expect((await getSession(user.client, id))?.sets).toHaveLength(keptSetIds.length);
  });

  it("should answer undo_unavailable, and write nothing, when the workout is already back in the history", async () => {
    const user = await createTestUser("key907");
    const { id, keptSetIds, deletedAt } = await deletedWorkout(user);
    const actionId = await storeAction(user, id, deletedAt);
    // Brought back by the repo call the first Undo makes, with the action left unclaimed, as a stray restore would.
    await restoreSession(user.client, id, { deletedAt });

    const results = await undoAssistantActions(user.client, [actionId]);

    expect(results).toEqual([{ actionId, result: "undo_unavailable" }]);
    expect((await getSession(user.client, id))?.sets).toHaveLength(keptSetIds.length);
  });

  it("should not restore the workout of another user", async () => {
    const owner = await createTestUser("key907");
    const stranger = await createTestUser("key907");
    const { id, deletedAt } = await deletedWorkout(owner);
    const actionId = await storeAction(stranger, id, deletedAt);

    const results = await undoAssistantActions(stranger.client, [actionId]);

    expect(results).toEqual([{ actionId, result: "undo_unavailable" }]);
    expect(await getSession(owner.client, id)).toBeNull();
  });
});
