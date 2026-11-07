import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dayIdsOf, findGlobalExercise, logSets, present, saveRoutine } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
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

// The session writes against the local stack with real user JWTs. Every test signs in its own user,
// because a session in progress is the user's, and the next start would find it. Every row is named
// key386- through its note or its user.

let globalExercise: SavedExercise;

beforeAll(async () => {
  globalExercise = await findGlobalExercise();
});

afterAll(async () => {
  // The users' sessions and sets go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

const freshUser = () => createTestUser("key386");

const NOT_A_SESSION = "00000000-0000-4000-8000-000000000000";

// Monday 12 October 2026, 00:30 in London (BST), which is still Sunday in UTC.
const MONDAY_HALF_PAST_MIDNIGHT_IN_LONDON = new Date("2026-10-11T23:30:00Z");

/** What a rejected call throws. Null when the call did not reject. */
const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

/** The stored row of a session as its owner sees it, soft deleted or not. The service role has no grant on the table. */
async function storedSession(user: TestUser, sessionId: string) {
  const { data, error } = await user.client
    .from("workout_sessions")
    .select("id,user_id,started_at,ended_at,local_date,tz,routine_day_id,note,deleted_at")
    .eq("id", sessionId)
    .single();
  if (error) {
    throw new Error(`Could not read the test session (${error.code})`);
  }
  return data;
}

async function openSessionCount(user: TestUser): Promise<number> {
  const { count, error } = await user.client
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .is("ended_at", null)
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Could not count the test sessions (${error.code})`);
  }
  return count ?? 0;
}

describe("startSession", () => {
  it("should store the routine day, and resolve to the session with the name of the day", async () => {
    const owner = await freshUser();
    const routineId = await saveRoutine(owner, null, [
      { weekday: 0, name: "key386-push", exerciseIds: [globalExercise.id] },
    ]);
    const routineDayId = present((await dayIdsOf(owner, routineId))[0], "the routine day");

    const session = await startSession(owner.client, {
      routineDayId,
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "Europe/London",
    });

    expect(session).toMatchObject({
      routine_day_id: routineDayId,
      routine_day_name: "key386-push",
      ended_at: null,
      local_date: "2026-10-18",
      sets: [],
    });
    expect(await storedSession(owner, session.id)).toMatchObject({
      user_id: owner.id,
      routine_day_id: routineDayId,
      tz: "Europe/London",
    });
  });

  it("should store a null routine day for a free session", async () => {
    const owner = await freshUser();

    const session = await startSession(owner.client, {
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "Europe/London",
    });

    expect(session).toMatchObject({ routine_day_id: null, routine_day_name: null });
    expect((await storedSession(owner, session.id)).routine_day_id).toBeNull();
  });

  it("should store Monday for a start at 00:30 on Monday in London", async () => {
    const owner = await freshUser();

    const session = await startSession(owner.client, {
      now: MONDAY_HALF_PAST_MIDNIGHT_IN_LONDON,
      tz: "Europe/London",
    });

    expect(session.local_date).toBe("2026-10-12");
    expect((await storedSession(owner, session.id)).started_at).toBe("2026-10-11T23:30:00+00:00");
  });

  it("should leave one open session when it is called twice, one call after the other", async () => {
    const owner = await freshUser();
    const input = { now: new Date("2026-10-18T09:00:00Z"), tz: "Europe/London" };

    const first = await startSession(owner.client, input);
    const second = await startSession(owner.client, {
      ...input,
      now: new Date("2026-10-18T09:00:05Z"),
    });

    expect(second.id).toBe(first.id);
    expect(await openSessionCount(owner)).toBe(1);
  });

  it("should start a new session once the last one has ended", async () => {
    const owner = await freshUser();
    const first = await startSession(owner.client, {
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "UTC",
    });
    await finishSession(owner.client, first.id, {
      endedAt: new Date("2026-10-18T10:00:00Z"),
      note: null,
    });

    const second = await startSession(owner.client, {
      now: new Date("2026-10-19T09:00:00Z"),
      tz: "UTC",
    });

    expect(second.id).not.toBe(first.id);
  });

  it("should leave exactly one open session when two starts overlap, both resolving to it", async () => {
    const owner = await freshUser();
    const input = { now: new Date("2026-10-18T09:00:00Z"), tz: "UTC" };

    const [first, second] = await Promise.all([
      startSession(owner.client, input),
      startSession(owner.client, input),
    ]);

    expect(second.id).toBe(first.id);
    expect(await openSessionCount(owner)).toBe(1);
  });

  it("should leave exactly one open session when many starts overlap", async () => {
    const owner = await freshUser();

    const sessions = await Promise.all(
      Array.from({ length: 5 }, (_, second) =>
        startSession(owner.client, {
          now: new Date(Date.UTC(2026, 9, 18, 9, 0, second)),
          tz: "UTC",
        }),
      ),
    );

    expect(new Set(sessions.map(({ id }) => id)).size).toBe(1);
    expect(await openSessionCount(owner)).toBe(1);
  });

  it("should refuse a routine day of another user, and store nothing", async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    const routineId = await saveRoutine(stranger, null, [
      { weekday: 0, name: "key386-theirs", exerciseIds: [globalExercise.id] },
    ]);
    const theirDayId = present((await dayIdsOf(stranger, routineId))[0], "the routine day");

    const error = await rejectionOf(
      startSession(owner.client, {
        routineDayId: theirDayId,
        now: new Date("2026-10-18T09:00:00Z"),
        tz: "UTC",
      }),
    );

    expect(error?.message).toBe("Could not start the session (42501)");
    expect(await openSessionCount(owner)).toBe(0);
  });
});

describe("finishSession", () => {
  const startedAt = new Date("2026-10-18T09:00:00Z");
  const endedAt = new Date("2026-10-18T10:00:00Z");

  it("should store the end and the trimmed note, and resolve to the session", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });

    const finished = await finishSession(owner.client, id, {
      endedAt,
      note: "  key386-felt strong  ",
    });

    expect(finished).toMatchObject({ id, note: "key386-felt strong" });
    expect(await storedSession(owner, id)).toMatchObject({
      ended_at: "2026-10-18T10:00:00+00:00",
      note: "key386-felt strong",
    });
  });

  it("should store a blank note as null", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });

    await finishSession(owner.client, id, { endedAt, note: "   " });

    expect((await storedSession(owner, id)).note).toBeNull();
  });

  it("should store a note of 1,000 characters and refuse one of 1,001 with the rule alone", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });
    const tooLong = `key386-${"n".repeat(994)}`;

    const error = await rejectionOf(finishSession(owner.client, id, { endedAt, note: tooLong }));

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session note must be 1,000 characters or fewer");
    expect(JSON.stringify({ message: error?.message, cause: error?.cause })).not.toContain(
      "key386-",
    );
    expect((await storedSession(owner, id)).ended_at).toBeNull();

    await finishSession(owner.client, id, { endedAt, note: tooLong.slice(1) });
    expect(Array.from(present((await storedSession(owner, id)).note, "the note"))).toHaveLength(
      1000,
    );
  });

  it("should refuse an end before the start, and leave the session open", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });

    const error = await rejectionOf(
      finishSession(owner.client, id, { endedAt: new Date("2026-10-18T08:59:59Z"), note: null }),
    );

    expect(error).toBeInstanceOf(RangeError);
    expect(error?.message).toBe("A session cannot end before it starts");
    expect((await storedSession(owner, id)).ended_at).toBeNull();
  });

  it("should set the end once, so finishing a finished session changes nothing", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });
    await finishSession(owner.client, id, { endedAt, note: "key386-first" });

    const again = await finishSession(owner.client, id, {
      endedAt: new Date("2026-10-18T12:00:00Z"),
      note: "key386-second",
    });

    expect(again).toMatchObject({ id, note: "key386-first" });
    expect(await storedSession(owner, id)).toMatchObject({
      ended_at: "2026-10-18T10:00:00+00:00",
      note: "key386-first",
    });
  });

  it("should not finish the session of another user", async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });

    const error = await rejectionOf(
      finishSession(stranger.client, id, { endedAt, note: "key386-not-yours" }),
    );

    expect(error?.message).toBe("Could not finish the session (PGRST116)");
    expect(JSON.stringify({ message: error?.message, cause: error?.cause })).not.toContain(
      "key386-",
    );
    expect(await storedSession(owner, id)).toMatchObject({ ended_at: null, note: null });
  });

  it("should not finish a session that was deleted", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });
    await deleteSession(owner.client, id);

    const error = await rejectionOf(finishSession(owner.client, id, { endedAt, note: null }));

    expect(error?.message).toBe("Could not finish the session (PGRST116)");
    expect((await storedSession(owner, id)).ended_at).toBeNull();
  });
});

describe("deleteSession", () => {
  it("should soft delete the session and its sets in one call", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, {
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "UTC",
    });
    const setIds = await logSets(owner, id, globalExercise, [
      { performedAt: "2026-10-18T09:10:00Z" },
      { performedAt: "2026-10-18T09:20:00Z" },
    ]);

    await deleteSession(owner.client, id);

    expect((await storedSession(owner, id)).deleted_at).not.toBeNull();
    const { data, error } = await owner.client
      .from("workout_sets")
      .select("id,deleted_at")
      .in("id", setIds);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data?.every((set) => set.deleted_at !== null)).toBe(true);
    expect(await getSession(owner.client, id)).toBeNull();
  });

  it("should not delete the session of another user", async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    const { id } = await startSession(owner.client, {
      now: new Date("2026-10-18T09:00:00Z"),
      tz: "UTC",
    });

    const error = await rejectionOf(deleteSession(stranger.client, id));

    expect(error?.message).toBe("Could not delete the session (P0002)");
    expect(error?.cause).toEqual({ code: "P0002" });
    expect((await storedSession(owner, id)).deleted_at).toBeNull();
  });

  it("should fail with the same code for a session that does not exist", async () => {
    const owner = await freshUser();

    const error = await rejectionOf(deleteSession(owner.client, NOT_A_SESSION));

    expect(error?.message).toBe("Could not delete the session (P0002)");
  });
});

describe("restoreSession", () => {
  const startedAt = new Date("2026-10-18T09:00:00Z");
  const heatNow = "2026-10-18T10:00:00Z";

  /** A finished session with three sets, one of them removed on its own before the delete, then deleted. */
  async function deletedSessionWithAnEarlierRemovedSet(owner: TestUser) {
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });
    const loggedIds = await logSets(owner, id, globalExercise, [
      { performedAt: "2026-10-18T09:10:00Z" },
      { performedAt: "2026-10-18T09:20:00Z" },
      { performedAt: "2026-10-18T09:30:00Z" },
    ]);
    const keptSetIds = [
      present(loggedIds[0], "a logged set"),
      present(loggedIds[2], "a logged set"),
    ];
    const removedEarlier = present(loggedIds[1], "a logged set");
    await finishSession(owner.client, id, {
      endedAt: new Date("2026-10-18T09:45:00Z"),
      note: null,
    });
    await removeSet(owner.client, removedEarlier);
    await deleteSession(owner.client, id);
    const deletedAt = present((await storedSession(owner, id)).deleted_at, "the delete stamp");
    return { id, keptSetIds, removedEarlier, deletedAt };
  }

  async function storedSetStamps(owner: TestUser, setIds: string[]) {
    const { data, error } = await owner.client
      .from("workout_sets")
      .select("id,deleted_at")
      .in("id", setIds);
    if (error) {
      throw new Error(`Could not read the test sets (${error.code})`);
    }
    return Object.fromEntries(data.map((set) => [set.id, set.deleted_at]));
  }

  const weeklySetsOfChest = async (owner: TestUser) =>
    (await readMuscleState(owner.client, { now: heatNow, timeZone: "UTC" })).chest_lower.weeklySets;

  it("should bring back the session and exactly the sets it had, and leave an earlier removed set removed", async () => {
    const owner = await freshUser();
    const { id, keptSetIds, removedEarlier, deletedAt } =
      await deletedSessionWithAnEarlierRemovedSet(owner);

    const restored = await restoreSession(owner.client, id, { deletedAt });

    expect(restored.id).toBe(id);
    expect(restored.sets.map((set) => set.id).sort()).toEqual([...keptSetIds].sort());
    expect((await storedSession(owner, id)).deleted_at).toBeNull();
    const stamps = await storedSetStamps(owner, [...keptSetIds, removedEarlier]);
    expect(keptSetIds.map((setId) => stamps[setId])).toEqual([null, null]);
    expect(stamps[removedEarlier]).not.toBeNull();
    expect(stamps[removedEarlier]).not.toBe(deletedAt);
    expect(await getSession(owner.client, id)).toEqual(restored);
  });

  it("should make heat count the sets again", async () => {
    const owner = await freshUser();
    const { id } = await startSession(owner.client, { now: startedAt, tz: "UTC" });
    await logSets(owner, id, globalExercise, [
      { performedAt: "2026-10-18T09:10:00Z" },
      { performedAt: "2026-10-18T09:20:00Z" },
    ]);
    const counted = await weeklySetsOfChest(owner);
    await deleteSession(owner.client, id);
    const deletedAt = present((await storedSession(owner, id)).deleted_at, "the delete stamp");
    const whileDeleted = await weeklySetsOfChest(owner);

    await restoreSession(owner.client, id, { deletedAt });

    expect(counted).toBeGreaterThan(0);
    expect(whileDeleted).toBe(0);
    expect(await weeklySetsOfChest(owner)).toBe(counted);
  });

  it("should change nothing when it is called a second time", async () => {
    const owner = await freshUser();
    const { id, keptSetIds, removedEarlier, deletedAt } =
      await deletedSessionWithAnEarlierRemovedSet(owner);
    const first = await restoreSession(owner.client, id, { deletedAt });
    const stampsAfterFirst = await storedSetStamps(owner, [...keptSetIds, removedEarlier]);

    const second = await restoreSession(owner.client, id, { deletedAt });

    expect(second).toEqual(first);
    expect(await storedSetStamps(owner, [...keptSetIds, removedEarlier])).toEqual(stampsAfterFirst);
  });

  it("should finish the job when it is run from its second step alone, as after a failure between the two", async () => {
    const owner = await freshUser();
    const { id, keptSetIds, deletedAt } = await deletedSessionWithAnEarlierRemovedSet(owner);
    // The first step done and the second not: the session is live, its sets still carry the stamp.
    const { error } = await owner.client
      .from("workout_sessions")
      .update({ deleted_at: null })
      .eq("id", id);
    expect(error).toBeNull();
    expect(await getSession(owner.client, id)).toMatchObject({ sets: [] });

    const restored = await restoreSession(owner.client, id, { deletedAt });

    expect(restored.sets.map((set) => set.id).sort()).toEqual([...keptSetIds].sort());
  });

  it("should fail for the session of another user and touch no row", async () => {
    const owner = await freshUser();
    const stranger = await freshUser();
    const { id, keptSetIds, removedEarlier, deletedAt } =
      await deletedSessionWithAnEarlierRemovedSet(owner);
    const stampsBefore = await storedSetStamps(owner, [...keptSetIds, removedEarlier]);

    const error = await rejectionOf(restoreSession(stranger.client, id, { deletedAt }));

    expect(error?.message).toBe("Could not restore the session (PGRST116)");
    expect(error?.cause).toEqual({ code: "PGRST116" });
    expect((await storedSession(owner, id)).deleted_at).toBe(deletedAt);
    expect(await storedSetStamps(owner, [...keptSetIds, removedEarlier])).toEqual(stampsBefore);
  });

  it("should fail with the same code for a session that does not exist", async () => {
    const owner = await freshUser();

    const error = await rejectionOf(
      restoreSession(owner.client, NOT_A_SESSION, { deletedAt: "2026-10-18T09:00:00+00:00" }),
    );

    expect(error?.message).toBe("Could not restore the session (PGRST116)");
  });

  it("should leave a session alone that was deleted again with another stamp", async () => {
    const owner = await freshUser();
    const { id, keptSetIds, deletedAt } = await deletedSessionWithAnEarlierRemovedSet(owner);

    const error = await rejectionOf(
      restoreSession(owner.client, id, { deletedAt: "2026-10-18T09:00:00+00:00" }),
    );

    expect(error?.message).toBe("Could not restore the session (PGRST116)");
    expect((await storedSession(owner, id)).deleted_at).toBe(deletedAt);
    expect(Object.values(await storedSetStamps(owner, keptSetIds)).every(Boolean)).toBe(true);
  });

  it("should refuse an id that is not a UUID and a stamp that is not a time, before any request", async () => {
    const owner = await freshUser();

    const badId = await rejectionOf(
      restoreSession(owner.client, "not-a-uuid", { deletedAt: "2026-10-18T09:00:00+00:00" }),
    );
    const badStamp = await rejectionOf(
      restoreSession(owner.client, NOT_A_SESSION, { deletedAt: "yesterday-ish" }),
    );

    expect(badId).toBeInstanceOf(RangeError);
    expect(badId?.message).toBe("A session id must be a UUID");
    expect(badStamp).toBeInstanceOf(RangeError);
    expect(badStamp?.message).toBe("A session delete stamp must be a timestamp");
  });
});
