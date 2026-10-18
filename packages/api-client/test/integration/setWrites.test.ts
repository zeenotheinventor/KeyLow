import { buildSetSnapshot, displayLoad } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findGlobalExercise, logSets, present, saveExercise } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { startSession } from "../../src/repos/sessionWrites";
import { addSet, removeSet, reorderSets, restoreSet, updateSet } from "../../src/repos/setWrites";
import { getSession } from "../../src/repos/trainingSessions";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";
import type { SetAdd } from "../../src/repos/setWrites";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

// The set writes against the local stack with real user JWTs. Every test signs in its own user, because
// a session in progress is the user's. Every exercise and user is named key388- through its label or
// its address, and the users' sessions and sets go with them (on delete cascade).

let globalExercise: SavedExercise;

beforeAll(async () => {
  globalExercise = await findGlobalExercise();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const NOT_A_ROW = "00000000-0000-4000-8000-000000000000";
const NOW = new Date("2026-10-18T09:30:00Z");

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

async function freshSession(user: TestUser): Promise<string> {
  const session = await startSession(user.client, { now: NOW, tz: "UTC" });
  return session.id;
}

const draftOf = (overrides: Partial<SetAdd["draft"]> = {}): SetAdd["draft"] => ({
  setType: "working",
  load: "60",
  reps: "8",
  rir: "2",
  rpe: "",
  ...overrides,
});

const log = (
  user: TestUser,
  sessionId: string,
  exerciseId: string,
  overrides: Partial<SetAdd> = {},
) =>
  addSet(user.client, {
    sessionId,
    exerciseId,
    draft: draftOf(),
    unit: "kg",
    effortMode: "rir",
    now: NOW,
    ...overrides,
  });

/** The stored row of a set as its owner sees it, removed or not. */
async function storedSet(user: TestUser, setId: string) {
  const { data, error } = await user.client
    .from("workout_sets")
    .select("session_id,exercise_id,position,set_type,reps,load_kg,rir,rpe,snapshot,deleted_at")
    .eq("id", setId)
    .single();
  if (error) {
    throw new Error(`Could not read the test set (${error.code})`);
  }
  return data;
}

async function editMuscleMap(
  user: TestUser,
  exercise: SavedExercise,
  muscles: ExerciseMuscleEntry[],
) {
  const { error } = await user.client.rpc("save_exercise", {
    p_exercise_id: exercise.id,
    p_exercise: { name: exercise.name, equipment: "barbell", mechanic: "compound" },
    p_muscles: muscles,
  });
  if (error) {
    throw new Error(`Could not edit the test exercise (${error.code})`);
  }
}

describe("addSet", () => {
  it("should store the load in whole grams, so a pound user's 225 reads back as 225", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);

    const set = await log(owner, sessionId, globalExercise.id, {
      draft: draftOf({ load: "225" }),
      unit: "lb",
    });

    expect((await storedSet(owner, set.id)).load_kg).toBe(102.058);
    expect(displayLoad(Number(set.load_kg), "lb")).toBe("225");
  });

  it("should store the snapshot that buildSetSnapshot gives for the exercise's map at log time", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const exercise = await saveExercise(owner, "snapshot");

    const set = await log(owner, sessionId, exercise.id, {});

    expect((await storedSet(owner, set.id)).snapshot).toEqual(exercise.snapshot);
  });

  it("should leave every existing set's snapshot byte for byte unchanged when the exercise's muscle map is edited afterwards", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const exercise = await saveExercise(owner, "map-edit");
    const set = await log(owner, sessionId, exercise.id, {});
    const before = await storedSet(owner, set.id);
    const newMap: ExerciseMuscleEntry[] = [{ muscle_id: "biceps", role: "primary", weight: 1 }];

    await editMuscleMap(owner, exercise, newMap);
    await updateSet(owner.client, set.id, { reps: 9 });

    const after = await storedSet(owner, set.id);
    expect(JSON.stringify(after.snapshot)).toBe(JSON.stringify(before.snapshot));
    expect(after.snapshot).toEqual(exercise.snapshot);
    // A set logged now freezes the edited map, which shows the edit did change the exercise.
    const later = await log(owner, sessionId, exercise.id, {});
    expect((await storedSet(owner, later.id)).snapshot).toEqual(
      buildSetSnapshot(
        { id: exercise.id, name: exercise.name, equipment: "barbell", mechanic: "compound" },
        newMap,
      ),
    );
  });

  it("should take the position one past the highest live set of the session", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);

    const first = await log(owner, sessionId, globalExercise.id);
    const second = await log(owner, sessionId, globalExercise.id);

    expect([first.position, second.position]).toEqual([0, 1]);
  });

  it("should store the RPE alone when the setting is RPE", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);

    const set = await log(owner, sessionId, globalExercise.id, {
      draft: draftOf({ rir: "", rpe: "8.5" }),
      effortMode: "rpe",
    });

    expect(await storedSet(owner, set.id)).toMatchObject({ rir: null, rpe: 8.5 });
  });

  it("should refuse the 201st live set with a rule and no value, and accept it once a set is removed", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const ids = await logSets(
      owner,
      sessionId,
      globalExercise,
      Array.from({ length: 200 }, (_, index) => ({
        performedAt: new Date(NOW.getTime() + index * 1000).toISOString(),
      })),
    );

    const refused = await rejectionOf(log(owner, sessionId, globalExercise.id));
    await removeSet(owner.client, present(ids[0], "the first set"));
    const accepted = await log(owner, sessionId, globalExercise.id);

    expect(refused).toBeInstanceOf(RangeError);
    expect(refused?.message).toBe("A session holds at most 200 live sets.");
    expect(accepted.position).toBe(200);
  });

  it("should fail the same way for another user's session as for one that does not exist", async () => {
    const owner = await createTestUser("key388");
    const stranger = await createTestUser("key388");
    const sessionId = await freshSession(owner);

    const foreign = await rejectionOf(log(stranger, sessionId, globalExercise.id));
    const missing = await rejectionOf(log(stranger, NOT_A_ROW, globalExercise.id));

    expect(foreign).toBeInstanceOf(Error);
    expect(foreign?.message).toMatch(/^Could not log the set \(\w+\)$/);
    expect(missing?.message).toBe(foreign?.message);
    expect((await getSession(owner.client, sessionId))?.sets).toEqual([]);
  });

  it("should fail the same way for another user's private exercise as for one that does not exist", async () => {
    const owner = await createTestUser("key388");
    const stranger = await createTestUser("key388");
    const privateExercise = await saveExercise(owner, "private");
    const sessionId = await freshSession(stranger);

    const foreign = await rejectionOf(log(stranger, sessionId, privateExercise.id));
    const missing = await rejectionOf(log(stranger, sessionId, NOT_A_ROW));

    expect(foreign?.message).toBe("Could not log the set (PGRST116)");
    expect(missing?.message).toBe(foreign?.message);
  });

  it("should refuse a set in a session that was finished or deleted without leaking a value", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const { error } = await owner.client
      .from("workout_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sessionId);
    expect(error).toBeNull();

    const refused = await rejectionOf(log(owner, sessionId, globalExercise.id));

    expect(refused?.message).toBe("Could not log the set (42501)");
    expect(refused?.cause).toEqual({ code: "42501" });
  });
});

describe("updateSet", () => {
  it("should store a load to the gram and leave the snapshot, the session and the exercise as they were", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const set = await log(owner, sessionId, globalExercise.id);
    const before = await storedSet(owner, set.id);

    const updated = await updateSet(owner.client, set.id, { load_kg: 100.0004, set_type: "drop" });

    const after = await storedSet(owner, set.id);
    expect(updated).toMatchObject({ load_kg: 100, set_type: "drop" });
    expect(after).toMatchObject({ load_kg: 100, set_type: "drop" });
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.session_id).toBe(before.session_id);
    expect(after.exercise_id).toBe(before.exercise_id);
  });

  it("should store one effort measure at most, whichever is changed", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const set = await log(owner, sessionId, globalExercise.id);

    await updateSet(owner.client, set.id, { rpe: 8 });
    expect(await storedSet(owner, set.id)).toMatchObject({ rir: null, rpe: 8 });

    await updateSet(owner.client, set.id, { rir: 3 });
    expect(await storedSet(owner, set.id)).toMatchObject({ rir: 3, rpe: null });
  });

  it("should fail the same way for a set of another user, a removed set and one that does not exist", async () => {
    const owner = await createTestUser("key388");
    const stranger = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const set = await log(owner, sessionId, globalExercise.id);
    const removed = await log(owner, sessionId, globalExercise.id);
    await removeSet(owner.client, removed.id);

    const foreign = await rejectionOf(updateSet(stranger.client, set.id, { reps: 9 }));
    const gone = await rejectionOf(updateSet(owner.client, removed.id, { reps: 9 }));
    const missing = await rejectionOf(updateSet(owner.client, NOT_A_ROW, { reps: 9 }));

    expect(foreign?.message).toBe("Could not update the set (PGRST116)");
    expect(gone?.message).toBe(foreign?.message);
    expect(missing?.message).toBe(foreign?.message);
    expect((await storedSet(owner, set.id)).reps).toBe(8);
  });
});

describe("removeSet and restoreSet", () => {
  it("should remove a set from the session read and bring it back in its place", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const first = await log(owner, sessionId, globalExercise.id);
    const second = await log(owner, sessionId, globalExercise.id);
    const third = await log(owner, sessionId, globalExercise.id);
    const idsRead = async () =>
      (await getSession(owner.client, sessionId))?.sets.map(({ id }) => id);

    await removeSet(owner.client, second.id);
    expect(await idsRead()).toEqual([first.id, third.id]);
    expect((await storedSet(owner, second.id)).deleted_at).not.toBeNull();

    await restoreSet(owner.client, second.id);
    expect(await idsRead()).toEqual([first.id, second.id, third.id]);
  });

  it("should refuse a restore into a session that already holds 200 live sets", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const ids = await logSets(
      owner,
      sessionId,
      globalExercise,
      Array.from({ length: 200 }, (_, index) => ({
        performedAt: new Date(NOW.getTime() + index * 1000).toISOString(),
      })),
    );
    const removedId = present(ids[0], "the first set");
    await removeSet(owner.client, removedId);
    await log(owner, sessionId, globalExercise.id);

    const refused = await rejectionOf(restoreSet(owner.client, removedId));

    expect(refused).toBeInstanceOf(RangeError);
    expect(refused?.message).toBe("A session holds at most 200 live sets.");
    expect((await storedSet(owner, removedId)).deleted_at).not.toBeNull();
  });

  it("should fail with PGRST116 for a set of another user, the same as one that does not exist", async () => {
    const owner = await createTestUser("key388");
    const stranger = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const set = await log(owner, sessionId, globalExercise.id);

    const foreignRemove = await rejectionOf(removeSet(stranger.client, set.id));
    const foreignRestore = await rejectionOf(restoreSet(stranger.client, set.id));
    const missing = await rejectionOf(removeSet(stranger.client, NOT_A_ROW));

    expect(foreignRemove?.message).toBe("Could not remove the set (PGRST116)");
    expect(missing?.message).toBe(foreignRemove?.message);
    expect(foreignRestore?.message).toBe("Could not restore the set (PGRST116)");
    expect((await storedSet(owner, set.id)).deleted_at).toBeNull();
  });
});

describe("reorderSets", () => {
  it("should change the order the session reads its sets in and nothing else", async () => {
    const owner = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const first = await log(owner, sessionId, globalExercise.id, {
      draft: draftOf({ load: "50" }),
    });
    const second = await log(owner, sessionId, globalExercise.id, {
      draft: draftOf({ load: "60" }),
    });
    const third = await log(owner, sessionId, globalExercise.id, {
      draft: draftOf({ load: "70" }),
    });
    const read = async () => (await getSession(owner.client, sessionId))?.sets ?? [];

    await reorderSets(owner.client, sessionId, [third.id, first.id, second.id]);

    const sets = await read();
    expect(sets.map(({ id }) => id)).toEqual([third.id, first.id, second.id]);
    expect(sets.map(({ load_kg }) => load_kg)).toEqual([70, 50, 60]);
    expect(sets.map(({ reps }) => reps)).toEqual([8, 8, 8]);
  });

  it("should refuse sets of another session, the same for another user's as for one that does not exist", async () => {
    const owner = await createTestUser("key388");
    const stranger = await createTestUser("key388");
    const sessionId = await freshSession(owner);
    const mine = await log(owner, sessionId, globalExercise.id);
    const strangerSession = await freshSession(stranger);
    const theirs = await log(stranger, strangerSession, globalExercise.id);

    const foreign = await rejectionOf(reorderSets(owner.client, sessionId, [mine.id, theirs.id]));
    const missing = await rejectionOf(reorderSets(owner.client, sessionId, [mine.id, NOT_A_ROW]));

    expect(foreign).toBeInstanceOf(RangeError);
    expect(missing?.message).toBe(foreign?.message);
    expect((await storedSet(stranger, theirs.id)).position).toBe(0);
  });
});
