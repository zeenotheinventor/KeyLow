import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { trainingSnapshotOf } from "../../fixtures/redTeamEdits.ts";
import { createRedTeamWorld } from "../../fixtures/redTeamWorld.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";
import { createUndoTurn } from "../../src/undoTurn.ts";

import type { RedTeamWorld } from "../../fixtures/redTeamWorld.ts";
import type { FixtureUser } from "../../src/fixtureUser.ts";

// The edit part of the red-team world (KEY-912) against the local stack: the rows it plants, the archive it makes
// through the tool's own confirmation, and the direct calls to the served `mcp` function. The users are new for the
// run and afterAll removes them. No model is called. It runs in CI's `db` job, and was not run when it was written.
const namePrefix = `key912-${crypto.randomUUID().slice(0, 8)}`;

const created: FixtureUser[] = [];
let userA: FixtureUser;
let userB: FixtureUser;
let world: RedTeamWorld;

beforeAll(async () => {
  const stack = inject("stack");
  userA = await createFixtureUser(stack, { namePrefix: `${namePrefix}-a` });
  created.push(userA);
  userB = await createFixtureUser(stack, { namePrefix: `${namePrefix}-b` });
  created.push(userB);
  world = await createRedTeamWorld({
    stack,
    userA,
    userB,
    serviceClient: adminClient(),
    undoTurn: createUndoTurn({ client: userA.client }),
  });
}, 120_000);

afterAll(async () => {
  await Promise.all(created.map((user) => user.remove().catch(() => undefined)));
});

describe("the edit rows of the red-team world against the local stack", () => {
  it("should plant A's rows once, give A a goal, and archive a routine through the tool's own confirmation", async () => {
    const rows = await world.edits.rows();
    const again = await world.edits.rows();

    expect(again).toEqual(rows);
    const { data: routines } = await userA.client
      .from("routines")
      .select("id,is_archived,is_active")
      .in("id", [rows.pushRoutineId, rows.spareRoutineId, rows.archivedRoutineId]);
    const byId = new Map((routines ?? []).map((routine) => [routine.id, routine]));
    expect(byId.get(rows.pushRoutineId)).toMatchObject({ is_archived: false, is_active: false });
    expect(byId.get(rows.spareRoutineId)).toMatchObject({ is_archived: false, is_active: false });
    expect(byId.get(rows.archivedRoutineId)).toMatchObject({ is_archived: true });
    const { count: goals } = await userA.client
      .from("training_goals")
      .select("*", { count: "exact", head: true })
      .is("effective_to", null);
    expect(goals).toBe(1);
    const { data: archivedExercise } = await userA.client
      .from("exercises")
      .select("deleted_at")
      .eq("id", rows.archivedExerciseId)
      .single();
    expect(archivedExercise?.deleted_at).not.toBeNull();
  }, 60_000);

  it("should leave no workout open after a call during one, and refuse the call", async () => {
    const rows = await world.edits.rows();
    const outcome = await world.edits.callDuringWorkout(
      "update_past_set",
      () => ({
        set_id: rows.baseIds.setIds[0],
        reps: 9,
        load: null,
        rir: null,
        rpe: null,
        set_type: null,
      }),
      { finishAndCallAgain: true },
    );

    expect(outcome.during.attempt.body).toContain("workout_in_progress");
    expect(outcome.during.actionRows).toBe(0);
    expect(outcome.changed).toBe(false);
    expect(outcome.after?.attempt.body).toMatch(/"status"\s*:\s*"ok"/);
    expect(outcome.after?.actionRows).toBe(1);
    const { count } = await userA.client
      .from("workout_sessions")
      .select("*", { count: "exact", head: true })
      .is("ended_at", null)
      .is("deleted_at", null);
    expect(count).toBe(0);
  }, 60_000);

  it("should ask again, and write nothing, when the words are not the button's", async () => {
    const outcome = await world.edits.answeredWithout(
      "archive_routine",
      (rows) => ({ routine_id: rows.spareRoutineId }),
      "Yes",
    );

    expect(outcome.asked.attempt.body).toContain("needs_confirmation");
    expect(outcome.answered.attempt.body).toContain("needs_confirmation");
    expect(outcome.answered.actionRows).toBe(0);
    expect(outcome.changed).toBe(false);
  }, 60_000);

  it("should read B's row as B and answer not_found to A, leaving B's snapshot as it was", async () => {
    await world.userB.ensureTrainingPlanted();
    const { routineId } = world.userB.training();
    const before = await trainingSnapshotOf(userB.client);
    const outcome = await world.edits.callOnRowOfB(
      "archive_routine",
      { routine_id: routineId },
      { tool: "get_routines", input: { routine_id: routineId } },
    );

    expect(outcome.control.body).toContain(routineId);
    expect(outcome.asA.attempt.body).toContain("not_found");
    expect(outcome.asA.actionRows).toBe(0);
    expect(outcome.changedForB).toBe(false);
    expect(await trainingSnapshotOf(userB.client)).toBe(before);
  }, 60_000);

  it("should take a snapshot that shows a changed column and nothing of another user", async () => {
    const rows = await world.edits.rows();
    const before = await trainingSnapshotOf(userA.client);
    await world.edits.callAsA("update_past_set", {
      set_id: rows.baseIds.setIds[0],
      reps: 11,
      load: null,
      rir: null,
      rpe: null,
      set_type: null,
    });

    expect(await trainingSnapshotOf(userA.client)).not.toBe(before);
    expect(before).not.toContain(world.userB.id);
  }, 60_000);
});
