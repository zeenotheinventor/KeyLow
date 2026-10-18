import { orderSessionSets } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dayIdsOf,
  findGlobalExercise,
  logSets,
  present,
  saveExercise,
  saveRoutine,
  softDeleteSession,
  softDeleteSet,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getMyWeightUnit } from "../../src/repos/targets";
import { getActiveSession, getLastPerformance, getSession } from "../../src/repos/trainingSessions";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

// The session reads against the local stack with real user JWTs. Every row is named key384- and each
// describe makes its own users, so the reads see exactly what the test wrote.

let shared: SavedExercise;

beforeAll(async () => {
  shared = await findGlobalExercise();
});

afterAll(async () => {
  // The users' sessions, sets, routines and exercises go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

const NOT_A_SESSION = "00000000-0000-4000-8000-000000000000";

describe("getSession", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let bench: SavedExercise;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key384"), createTestUser("key384")]);
    bench = await saveExercise(owner, "session-bench");
  });

  it("should list the sets by position, then when they were performed, then id, as core orders them", async () => {
    const session = await startSession(owner, "2026-10-18");
    // Logged out of order, with two pairs that tie on position and time, so only the id settles them.
    const [late, first, earlySamePosition, tieOne, tieTwo] = await logSets(owner, session, bench, [
      { position: 1, performedAt: "2026-10-18T09:10:00Z" },
      { position: 0, performedAt: "2026-10-18T09:30:00Z" },
      { position: 1, performedAt: "2026-10-18T09:05:00Z" },
      { position: 2, performedAt: "2026-10-18T09:40:00Z" },
      { position: 2, performedAt: "2026-10-18T09:40:00Z" },
    ]);
    const tied = [present(tieOne, "a set"), present(tieTwo, "a set")].sort();

    const read = await getSession(owner.client, session);

    expect(read?.sets.map(({ id }) => id)).toEqual([
      present(first, "a set"),
      present(earlySamePosition, "a set"),
      present(late, "a set"),
      ...tied,
    ]);
    expect(orderSessionSets(read?.sets ?? []).map(({ id }) => id)).toEqual(
      read?.sets.map(({ id }) => id),
    );
  });

  it("should return the session's columns, the sets' values and their snapshots, and the routine day's name", async () => {
    const routineId = await saveRoutine(owner, null, [
      { weekday: 3, name: "key384-legs", exerciseIds: [bench.id] },
    ]);
    const routineDayId = present((await dayIdsOf(owner, routineId))[0], "the routine day");
    const session = await startSession(owner, "2026-10-17", { routineDayId });
    const [setId] = await logSets(owner, session, bench, [
      { performedAt: "2026-10-17T09:30:00Z", reps: 11, loadKg: 82.5, rir: 1 },
    ]);

    const read = await getSession(owner.client, session);

    expect(read).toMatchObject({
      id: session,
      ended_at: null,
      local_date: "2026-10-17",
      routine_day_id: routineDayId,
      routine_day_name: "key384-legs",
      deleted_at: null,
    });
    expect(Date.parse(read?.started_at ?? "")).toBe(Date.parse("2026-10-17T09:00:00Z"));
    expect(read?.sets).toEqual([
      expect.objectContaining({
        id: setId,
        session_id: session,
        exercise_id: bench.id,
        position: 0,
        set_type: "working",
        reps: 11,
        load_kg: 82.5,
        rir: 1,
        rpe: null,
        snapshot: bench.snapshot,
        deleted_at: null,
      }),
    ]);
  });

  it("should give a free session no routine day name", async () => {
    const session = await startSession(owner, "2026-10-16");

    expect(await getSession(owner.client, session)).toMatchObject({
      routine_day_id: null,
      routine_day_name: null,
      sets: [],
    });
  });

  it("should read a session that has ended", async () => {
    const session = await startSession(owner, "2026-10-15", {
      endedAt: "2026-10-15T09:50:00Z",
    });

    const read = await getSession(owner.client, session);

    expect(Date.parse(read?.ended_at ?? "")).toBe(Date.parse("2026-10-15T09:50:00Z"));
  });

  it("should leave out the soft-deleted sets", async () => {
    const session = await startSession(owner, "2026-10-14");
    const [kept, removed] = await logSets(owner, session, bench, [
      { performedAt: "2026-10-14T09:30:00Z" },
      { performedAt: "2026-10-14T09:35:00Z" },
    ]);
    await softDeleteSet(owner, present(removed, "a set"));

    const read = await getSession(owner.client, session);

    expect(read?.sets.map(({ id }) => id)).toEqual([present(kept, "a set")]);
  });

  it("should read a soft-deleted session as null", async () => {
    const session = await startSession(owner, "2026-10-13");
    await logSets(owner, session, bench, [{ performedAt: "2026-10-13T09:30:00Z" }]);
    await softDeleteSession(owner, session);

    expect(await getSession(owner.client, session)).toBeNull();
  });

  it("should read another user's session, and one that does not exist, as null, the same", async () => {
    const session = await startSession(owner, "2026-10-12");
    await logSets(owner, session, bench, [{ performedAt: "2026-10-12T09:30:00Z" }]);

    expect(await getSession(owner.client, session)).not.toBeNull();
    expect(await getSession(stranger.client, session)).toBeNull();
    expect(await getSession(owner.client, NOT_A_SESSION)).toBeNull();
  });
});

describe("getActiveSession", () => {
  it("should be null for a user who has not started a session", async () => {
    const user = await createTestUser("key384");

    expect(await getActiveSession(user.client)).toBeNull();
  });

  it("should find the newest live session that has not ended, with its sets, and name its routine day", async () => {
    const user = await createTestUser("key384");
    const bench = await saveExercise(user, "active-bench");
    const routineId = await saveRoutine(user, null, [
      { weekday: 3, name: "key384-pull", exerciseIds: [bench.id] },
    ]);
    const routineDayId = present((await dayIdsOf(user, routineId))[0], "the routine day");
    await startSession(user, "2026-10-10");
    const open = await startSession(user, "2026-10-17", { routineDayId });
    const [setId] = await logSets(user, open, bench, [{ performedAt: "2026-10-17T09:30:00Z" }]);

    const active = await getActiveSession(user.client);

    expect(active).toMatchObject({ id: open, ended_at: null, routine_day_name: "key384-pull" });
    expect(active?.sets.map(({ id }) => id)).toEqual([present(setId, "a set")]);
    expect(active?.sets[0]?.snapshot).toEqual(bench.snapshot);
  });

  it("should skip a session that has ended, however new, and one that is soft deleted", async () => {
    const user = await createTestUser("key384");
    const older = await startSession(user, "2026-10-10");
    await startSession(user, "2026-10-14", { endedAt: "2026-10-14T09:40:00Z" });
    const deleted = await startSession(user, "2026-10-16");
    await softDeleteSession(user, deleted);

    expect((await getActiveSession(user.client))?.id).toBe(older);
  });

  it("should be null once the only session has ended", async () => {
    const user = await createTestUser("key384");
    await startSession(user, "2026-10-14", { endedAt: "2026-10-14T09:40:00Z" });

    expect(await getActiveSession(user.client)).toBeNull();
  });

  it("should leave out the soft-deleted sets of the session", async () => {
    const user = await createTestUser("key384");
    const bench = await saveExercise(user, "active-deleted");
    const open = await startSession(user, "2026-10-17");
    const [kept, removed] = await logSets(user, open, bench, [
      { performedAt: "2026-10-17T09:30:00Z" },
      { performedAt: "2026-10-17T09:35:00Z" },
    ]);
    await softDeleteSet(user, present(removed, "a set"));

    const active = await getActiveSession(user.client);

    expect(active?.sets.map(({ id }) => id)).toEqual([present(kept, "a set")]);
  });

  it("should never find another user's session in progress", async () => {
    const [owner, stranger] = await Promise.all([
      createTestUser("key384"),
      createTestUser("key384"),
    ]);
    const open = await startSession(owner, "2026-10-17");

    expect((await getActiveSession(owner.client))?.id).toBe(open);
    expect(await getActiveSession(stranger.client)).toBeNull();
  });
});

describe("getLastPerformance", () => {
  /** A session of `user` on this day with these sets of the shared exercise. */
  const train = async (
    user: TestUser,
    localDate: string,
    sets: Parameters<typeof logSets>[3],
    exercise = shared,
  ) => {
    const session = await startSession(user, localDate);
    const ids = await logSets(user, session, exercise, sets);
    return { session, ids: ids.map((id) => present(id, "a set")) };
  };

  const at = (localDate: string, time = "09:30:00") => `${localDate}T${time}Z`;

  it("should give the two latest earlier sessions, newest first, with their local dates and no warm-up", async () => {
    const user = await createTestUser("key384");
    await train(user, "2026-09-20", [{ performedAt: at("2026-09-20") }]);
    await train(user, "2026-09-27", [{ performedAt: at("2026-09-27") }]);
    const third = await train(user, "2026-10-04", [{ performedAt: at("2026-10-04") }]);
    const latest = await train(user, "2026-10-11", [
      { position: 0, setType: "warmup", performedAt: at("2026-10-11", "09:20:00"), loadKg: 40 },
      { position: 1, performedAt: at("2026-10-11", "09:30:00"), loadKg: 100 },
      { position: 2, performedAt: at("2026-10-11", "09:40:00"), loadKg: 100 },
    ]);
    const current = await startSession(user, "2026-10-18");

    const sessions = await getLastPerformance(user.client, shared.id, {
      excludeSessionId: current,
    });

    expect(sessions.map(({ session_id, local_date }) => [session_id, local_date])).toEqual([
      [latest.session, "2026-10-11"],
      [third.session, "2026-10-04"],
    ]);
    expect(sessions[0]?.sets.map(({ id }) => id)).toEqual(latest.ids.slice(1));
    expect(sessions.flatMap(({ sets }) => sets.map(({ set_type }) => set_type))).not.toContain(
      "warmup",
    );
  });

  it("should never return the excluded session, and reach one session further back instead", async () => {
    const user = await createTestUser("key384");
    const oldest = await train(user, "2026-09-27", [{ performedAt: at("2026-09-27") }]);
    const middle = await train(user, "2026-10-04", [{ performedAt: at("2026-10-04") }]);
    const newest = await train(user, "2026-10-11", [{ performedAt: at("2026-10-11") }]);

    const withNewest = await getLastPerformance(user.client, shared.id);
    const withoutNewest = await getLastPerformance(user.client, shared.id, {
      excludeSessionId: newest.session,
    });

    expect(withNewest.map(({ session_id }) => session_id)).toEqual([
      newest.session,
      middle.session,
    ]);
    expect(withoutNewest.map(({ session_id }) => session_id)).toEqual([
      middle.session,
      oldest.session,
    ]);
  });

  it("should count working, drop and failure sets and leave out warm-ups", async () => {
    const user = await createTestUser("key384");
    const { session } = await train(user, "2026-10-11", [
      { position: 0, setType: "warmup", performedAt: at("2026-10-11", "09:10:00") },
      { position: 1, setType: "working", performedAt: at("2026-10-11", "09:20:00") },
      { position: 2, setType: "drop", performedAt: at("2026-10-11", "09:30:00") },
      { position: 3, setType: "failure", performedAt: at("2026-10-11", "09:40:00") },
    ]);

    const [read] = await getLastPerformance(user.client, shared.id);

    expect(read?.session_id).toBe(session);
    expect(read?.sets.map(({ set_type }) => set_type)).toEqual(["working", "drop", "failure"]);
  });

  it("should leave out soft-deleted sets and the sets of a soft-deleted session", async () => {
    const user = await createTestUser("key384");
    const kept = await train(user, "2026-10-04", [{ performedAt: at("2026-10-04") }]);
    const withRemovedSet = await train(user, "2026-10-11", [
      { position: 0, performedAt: at("2026-10-11", "09:30:00") },
      { position: 1, performedAt: at("2026-10-11", "09:40:00") },
    ]);
    const removedSession = await train(user, "2026-10-18", [{ performedAt: at("2026-10-18") }]);
    await softDeleteSet(user, present(withRemovedSet.ids[1], "a set"));
    await softDeleteSession(user, removedSession.session);

    const sessions = await getLastPerformance(user.client, shared.id);

    expect(sessions.map(({ session_id }) => session_id)).toEqual([
      withRemovedSet.session,
      kept.session,
    ]);
    expect(sessions[0]?.sets.map(({ id }) => id)).toEqual([
      present(withRemovedSet.ids[0], "a set"),
    ]);
  });

  it("should never return another user's sets, whichever way round", async () => {
    const [userA, userB] = await Promise.all([createTestUser("key384"), createTestUser("key384")]);
    const ownA = await train(userA, "2026-10-04", [{ performedAt: at("2026-10-04") }]);
    // B trained the same exercise more recently, and more times, than A.
    const ownB = [
      await train(userB, "2026-10-11", [{ performedAt: at("2026-10-11") }]),
      await train(userB, "2026-10-12", [{ performedAt: at("2026-10-12") }]),
      await train(userB, "2026-10-13", [{ performedAt: at("2026-10-13") }]),
    ];

    const seenByA = await getLastPerformance(userA.client, shared.id);
    const seenByB = await getLastPerformance(userB.client, shared.id);

    expect(seenByA.map(({ session_id }) => session_id)).toEqual([ownA.session]);
    expect(seenByB.map(({ session_id }) => session_id)).toEqual(
      [...ownB]
        .reverse()
        .slice(0, 2)
        .map(({ session }) => session),
    );
  });

  it("should give the sets of a session in list order, as core orders them", async () => {
    const user = await createTestUser("key384");
    await train(user, "2026-10-11", [
      { position: 2, performedAt: at("2026-10-11", "09:10:00") },
      { position: 0, performedAt: at("2026-10-11", "09:50:00") },
      { position: 1, performedAt: at("2026-10-11", "09:40:00") },
      { position: 1, performedAt: at("2026-10-11", "09:20:00") },
    ]);

    const [read] = await getLastPerformance(user.client, shared.id);

    expect(read?.sets.map(({ position }) => position)).toEqual([0, 1, 1, 2]);
    const asHistorySets = (read?.sets ?? []).map((set) => ({
      ...set,
      exercise_id: shared.id,
      snapshot: shared.snapshot,
    }));
    expect(orderSessionSets(asHistorySets).map(({ id }) => id)).toEqual(
      read?.sets.map(({ id }) => id),
    );
  });

  it("should leave out the sets of every other exercise", async () => {
    const user = await createTestUser("key384");
    const own = await saveExercise(user, "last-other");
    const trained = await train(user, "2026-10-11", [{ performedAt: at("2026-10-11") }]);
    await train(user, "2026-10-12", [{ performedAt: at("2026-10-12") }], own);

    const sessions = await getLastPerformance(user.client, shared.id);

    expect(sessions.map(({ session_id }) => session_id)).toEqual([trained.session]);
  });

  it("should read 60 rows at most, the newest", async () => {
    const user = await createTestUser("key384");
    const session = await startSession(user, "2026-10-11");
    const minute = (index: number) =>
      `2026-10-11T${String(Math.floor(index / 60) + 8).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00Z`;
    await logSets(
      user,
      session,
      shared,
      Array.from({ length: 70 }, (_, index) => ({ performedAt: minute(index) })),
    );

    const [read] = await getLastPerformance(user.client, shared.id);

    expect(read?.sets).toHaveLength(60);
    // The ten oldest are the ones cut: the sets start at the eleventh.
    expect(read?.sets[0]?.position).toBe(10);
  });

  it("should be empty for an exercise the user has never trained", async () => {
    const user = await createTestUser("key384");

    expect(await getLastPerformance(user.client, shared.id)).toEqual([]);
  });
});

describe("getMyWeightUnit", () => {
  it("should read kg for a new profile, lb once it is set, and kg again for stone", async () => {
    const user = await createTestUser("key384");

    const fresh = await getMyWeightUnit(user.client);
    await user.client.from("profiles").update({ weight_unit: "lb" }).eq("id", user.id);
    const pounds = await getMyWeightUnit(user.client);
    await user.client.from("profiles").update({ weight_unit: "st" }).eq("id", user.id);
    const stone = await getMyWeightUnit(user.client);

    expect([fresh, pounds, stone]).toEqual(["kg", "lb", "kg"]);
  });
});
