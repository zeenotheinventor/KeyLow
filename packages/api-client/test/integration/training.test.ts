import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BENCH_MUSCLES,
  dayIdsOf,
  logSets,
  present,
  saveExercise,
  saveRoutine,
  setActiveRoutine,
  softDeleteSession,
  softDeleteSet,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getActiveRoutine, listSetsFrom, listWeekSessions } from "../../src/repos/training";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

// The training reads against the local stack with real user JWTs. Every row is named key354- and each
// user is made for this file, so the reads see exactly what the test wrote.

let userA: TestUser;
let userB: TestUser;
let userC: TestUser;
let benchA: SavedExercise;

beforeAll(async () => {
  [userA, userB, userC] = await Promise.all([
    createTestUser("key354"),
    createTestUser("key354"),
    createTestUser("key354"),
  ]);
  benchA = await saveExercise(userA, "bench");
});

afterAll(async () => {
  // The users' sessions, sets, routines and exercises go with them (on delete cascade).
  await deleteCreatedTestUsers();
});

describe("listSetsFrom", () => {
  it("should return the live sets of live sessions inside the days, oldest first, with their snapshots", async () => {
    const user = userC;
    const bench = await saveExercise(user, "window");
    const before = await startSession(user, "2026-09-30");
    const first = await startSession(user, "2026-10-03");
    const last = await startSession(user, "2026-10-18");
    const after = await startSession(user, "2026-10-19");
    await logSets(user, before, bench, [{ performedAt: "2026-09-30T09:30:00Z" }]);
    const [firstKept, firstDeleted] = await logSets(user, first, bench, [
      { performedAt: "2026-10-03T09:30:00Z", rir: 1 },
      { performedAt: "2026-10-03T09:35:00Z" },
    ]);
    const [lastKept] = await logSets(user, last, bench, [
      { performedAt: "2026-10-18T09:30:00Z", rir: null, rpe: 8.5 },
    ]);
    await logSets(user, after, bench, [{ performedAt: "2026-10-19T09:30:00Z" }]);
    await softDeleteSet(user, present(firstDeleted, "the second set"));

    const sets = await listSetsFrom(user.client, "2026-10-03", "2026-10-18");

    expect(sets.map(({ id }) => id)).toEqual([
      present(firstKept, "a set"),
      present(lastKept, "a set"),
    ]);
    expect(sets[0]).toMatchObject({
      session_id: first,
      exercise_id: bench.id,
      set_type: "working",
      rir: 1,
      rpe: null,
      deleted_at: null,
      snapshot: bench.snapshot,
    });
    expect(sets[1]).toMatchObject({ session_id: last, rir: null, rpe: 8.5 });
  });

  it("should leave out the sets of a soft-deleted session", async () => {
    const user = userB;
    const bench = await saveExercise(user, "deleted-session");
    const kept = await startSession(user, "2026-10-10");
    const deleted = await startSession(user, "2026-10-11");
    const [keptSet] = await logSets(user, kept, bench, [{ performedAt: "2026-10-10T09:30:00Z" }]);
    await logSets(user, deleted, bench, [{ performedAt: "2026-10-11T09:30:00Z" }]);
    await softDeleteSession(user, deleted);

    const sets = await listSetsFrom(user.client, "2026-10-01", "2026-10-18");

    expect(sets.map(({ id }) => id)).toEqual([present(keptSet, "a set")]);
  });

  it("should never return another user's sets", async () => {
    const lonely = await createTestUser("key354");
    const sessionA = await startSession(userA, "2026-10-12");
    const [setA] = await logSets(userA, sessionA, benchA, [
      { performedAt: "2026-10-12T09:30:00Z" },
    ]);

    const seenByA = await listSetsFrom(userA.client, "2026-10-01", "2026-10-18");
    const seenByLonely = await listSetsFrom(lonely.client, "2026-10-01", "2026-10-18");

    expect(seenByA.map(({ id }) => id)).toContain(setA);
    expect(seenByLonely).toEqual([]);
  });

  it("should read every set past the 1,000 a request holds", async () => {
    const user = await createTestUser("key354");
    const bench = await saveExercise(user, "many");
    const session = await startSession(user, "2026-10-05");
    const day = (index: number) =>
      `2026-10-05T${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00Z`;
    for (let start = 0; start < 1005; start += 335) {
      await logSets(
        user,
        session,
        bench,
        Array.from({ length: 335 }, (_, offset) => ({ performedAt: day(start + offset) })),
      );
    }

    const sets = await listSetsFrom(user.client, "2026-10-01", "2026-10-18");

    expect(sets).toHaveLength(1005);
    expect(new Set(sets.map(({ id }) => id)).size).toBe(1005);
    expect(sets.map(({ performed_at }) => performed_at)).toEqual(
      [...sets.map(({ performed_at }) => performed_at)].sort(),
    );
  });
});

describe("getActiveRoutine", () => {
  it("should resolve to null for a user with no active routine, whatever routines they have saved", async () => {
    const user = await createTestUser("key354");
    const bench = await saveExercise(user, "inactive");
    await saveRoutine(user, null, [{ weekday: 0, name: "push", exerciseIds: [bench.id] }]);

    expect(await getActiveRoutine(user.client)).toBeNull();
  });

  it("should return the active routine with its days and exercises in position order and the current muscle maps", async () => {
    const user = await createTestUser("key354");
    const bench = await saveExercise(user, "plan-bench");
    const curl = await saveExercise(user, "plan-curl", [
      { muscle_id: "biceps", role: "primary", weight: 1 },
    ]);
    const routineId = await saveRoutine(user, null, [
      { weekday: 3, name: "pull", exerciseIds: [curl.id, bench.id], targetSets: 4 },
      { weekday: 0, name: "push", exerciseIds: [bench.id] },
    ]);
    await setActiveRoutine(user, routineId);
    // A second routine that is not active.
    await saveRoutine(user, null, [{ weekday: 1, name: "other", exerciseIds: [curl.id] }]);

    const routine = present(await getActiveRoutine(user.client), "the active routine");

    expect(routine.id).toBe(routineId);
    expect(routine.days.map(({ position, weekday }) => [position, weekday])).toEqual([
      [0, 3],
      [1, 0],
    ]);
    const [pull, push] = routine.days;
    expect(
      pull?.exercises.map(({ position, exercise_id, target_sets, target_rir }) => ({
        position,
        exercise_id,
        target_sets,
        target_rir,
      })),
    ).toEqual([
      { position: 0, exercise_id: curl.id, target_sets: 4, target_rir: 2 },
      { position: 1, exercise_id: bench.id, target_sets: 4, target_rir: 2 },
    ]);
    expect(pull?.exercises[0]?.exercise).toEqual({
      id: curl.id,
      name: curl.name,
      equipment: "barbell",
      mechanic: "compound",
    });
    expect(pull?.exercises[0]?.muscles).toEqual([
      { muscle_id: "biceps", role: "primary", weight: 1 },
    ]);
    expect(push?.exercises[0]?.muscles).toEqual(expect.arrayContaining(BENCH_MUSCLES));
    expect(push?.exercises[0]?.muscles).toHaveLength(BENCH_MUSCLES.length);
  });

  it("should read an exercise's map as it is now, while a logged set keeps the map it was logged with", async () => {
    const user = await createTestUser("key354");
    const bench = await saveExercise(user, "edited");
    const routineId = await saveRoutine(user, null, [
      { weekday: 0, name: "push", exerciseIds: [bench.id] },
    ]);
    await setActiveRoutine(user, routineId);
    const session = await startSession(user, "2026-10-12");
    await logSets(user, session, bench, [{ performedAt: "2026-10-12T09:30:00Z" }]);

    const { error } = await user.client.rpc("save_exercise", {
      p_exercise_id: bench.id,
      p_exercise: { name: bench.name, equipment: "barbell", mechanic: "compound" },
      p_muscles: [{ muscle_id: "delt_front", role: "primary", weight: 1 }],
    });
    expect(error).toBeNull();

    const routine = present(await getActiveRoutine(user.client), "the active routine");
    const [set] = await listSetsFrom(user.client, "2026-10-01", "2026-10-18");
    expect(routine.days[0]?.exercises[0]?.muscles).toEqual([
      { muscle_id: "delt_front", role: "primary", weight: 1 },
    ]);
    expect(set?.snapshot.muscles).toEqual(bench.snapshot.muscles);
  });

  it("should never return another user's routine", async () => {
    const owner = await createTestUser("key354");
    const bench = await saveExercise(owner, "owned");
    const routineId = await saveRoutine(owner, null, [
      { weekday: 0, name: "push", exerciseIds: [bench.id] },
    ]);
    await setActiveRoutine(owner, routineId);
    const stranger = await createTestUser("key354");

    expect(await getActiveRoutine(stranger.client)).toBeNull();
    expect(present(await getActiveRoutine(owner.client), "the routine").id).toBe(routineId);
  });
});

describe("listWeekSessions", () => {
  it("should return the live sessions of the Monday to Sunday with their live sets in order", async () => {
    const user = await createTestUser("key354");
    const bench = await saveExercise(user, "week");
    const routineId = await saveRoutine(user, null, [
      { weekday: 0, name: "push", exerciseIds: [bench.id] },
    ]);
    const [mondayDayId] = await dayIdsOf(user, routineId);
    const sunday = await startSession(user, "2026-10-11");
    const monday = await startSession(user, "2026-10-12", {
      routineDayId: present(mondayDayId, "the day"),
    });
    const lastDay = await startSession(user, "2026-10-18");
    const nextMonday = await startSession(user, "2026-10-19");
    const deleted = await startSession(user, "2026-10-14");
    await logSets(user, sunday, bench, [{ performedAt: "2026-10-11T09:30:00Z" }]);
    const [second, first, removed] = await logSets(user, monday, bench, [
      { performedAt: "2026-10-12T09:40:00Z" },
      { performedAt: "2026-10-12T09:30:00Z" },
      { performedAt: "2026-10-12T09:50:00Z" },
    ]);
    await logSets(user, lastDay, bench, [{ performedAt: "2026-10-18T09:30:00Z" }]);
    await logSets(user, nextMonday, bench, [{ performedAt: "2026-10-19T09:30:00Z" }]);
    await logSets(user, deleted, bench, [{ performedAt: "2026-10-14T09:30:00Z" }]);
    await softDeleteSet(user, present(removed, "a set"));
    await softDeleteSession(user, deleted);

    const sessions = await listWeekSessions(user.client, "2026-10-12");

    expect(sessions.map(({ id, local_date }) => [id, local_date])).toEqual([
      [monday, "2026-10-12"],
      [lastDay, "2026-10-18"],
    ]);
    expect(sessions[0]?.routine_day_id).toBe(mondayDayId);
    expect(sessions[0]?.sets.map(({ id }) => id)).toEqual([
      present(first, "a set"),
      present(second, "a set"),
    ]);
    expect(sessions[0]?.sets[0]).toMatchObject({ session_id: monday, snapshot: bench.snapshot });
  });

  it("should return a session with no sets as a session with an empty list", async () => {
    const user = await createTestUser("key354");
    const empty = await startSession(user, "2026-10-13");

    const sessions = await listWeekSessions(user.client, "2026-10-12");

    expect(sessions).toEqual([
      { id: empty, local_date: "2026-10-13", routine_day_id: null, deleted_at: null, sets: [] },
    ]);
  });

  it("should never return another user's sessions or sets", async () => {
    const sessionA = await startSession(userA, "2026-10-13");
    await logSets(userA, sessionA, benchA, [{ performedAt: "2026-10-13T09:30:00Z" }]);
    const stranger = await createTestUser("key354");

    expect(await listWeekSessions(stranger.client, "2026-10-12")).toEqual([]);
    expect((await listWeekSessions(userA.client, "2026-10-12")).map(({ id }) => id)).toContain(
      sessionA,
    );
  });
});

describe("the local date of a session", () => {
  // 23:10 UTC on Sunday the 11th is 00:10 on Monday the 12th in London (BST), so the user's day is Monday.
  const SUNDAY_NIGHT_UTC = "2026-10-11T23:10:00Z";

  it("should put a set performed on Sunday in UTC into the Monday of its session, in the week and in the sets window", async () => {
    const user = await createTestUser("key354");
    const bench = await saveExercise(user, "midnight");
    const session = await startSession(user, "2026-10-12", {
      startedAt: SUNDAY_NIGHT_UTC,
      tz: "Europe/London",
    });
    const [set] = await logSets(user, session, bench, [{ performedAt: SUNDAY_NIGHT_UTC }]);

    const week = await listWeekSessions(user.client, "2026-10-12");
    const previousWeek = await listWeekSessions(user.client, "2026-10-05");
    const mondayOnly = await listSetsFrom(user.client, "2026-10-12", "2026-10-12");
    const sundayOnly = await listSetsFrom(user.client, "2026-10-11", "2026-10-11");

    expect(week.map(({ id }) => id)).toEqual([session]);
    expect(week[0]?.sets.map(({ id }) => id)).toEqual([present(set, "a set")]);
    expect(previousWeek).toEqual([]);
    expect(mondayOnly.map(({ id }) => id)).toEqual([present(set, "a set")]);
    expect(sundayOnly).toEqual([]);
  });
});
