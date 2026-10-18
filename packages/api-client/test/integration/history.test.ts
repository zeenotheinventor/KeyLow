import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dayIdsOf,
  findGlobalExercise,
  logSets,
  present,
  saveRoutine,
  softDeleteSession,
  softDeleteSet,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { deleteSession } from "../../src/repos/sessionWrites";
import { findPreviousSessionWeek, listSessionsInWeek } from "../../src/repos/trainingHistory";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

// The history reads against the local stack with real user JWTs. Every user is made for its test, and
// every row is named key387- through the user or the session's note.

let exercise: SavedExercise;

beforeAll(async () => {
  exercise = await findGlobalExercise();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

/** Logs `count` working sets in the session, one minute apart from the hour given. */
const logWorking = (user: TestUser, session: string, startedAt: string, count: number) =>
  logSets(
    user,
    session,
    exercise,
    Array.from({ length: count }, (_, index) => ({
      performedAt: new Date(Date.parse(startedAt) + (index + 1) * 60_000).toISOString(),
    })),
  );

/** The golden week's three sessions (12, 13 and 15 October) and a week before it with four (5, 6, 8 and 10). */
async function logTwoWeeks(user: TestUser, routineDayId: string | null = null) {
  const sessions: Record<string, string> = {};
  const days: [string, number][] = [
    ["2026-10-05", 4],
    ["2026-10-06", 3],
    ["2026-10-08", 4],
    ["2026-10-10", 4],
    ["2026-10-12", 5],
    ["2026-10-13", 6],
    ["2026-10-15", 3],
  ];
  for (const [localDate, workingSets] of days) {
    const startedAt = `${localDate}T17:00:00Z`;
    const session = await startSession(user, localDate, {
      startedAt,
      routineDayId: localDate >= "2026-10-12" ? routineDayId : null,
    });
    await logWorking(user, session, startedAt, workingSets);
    sessions[localDate] = session;
  }
  return sessions;
}

describe("listSessionsInWeek", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let sessions: Record<string, string>;
  let dayName: string;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key387"), createTestUser("key387")]);
    dayName = "key387-push";
    const routineId = await saveRoutine(owner, null, [
      { weekday: 0, name: dayName, exerciseIds: [exercise.id] },
    ]);
    const routineDayId = present((await dayIdsOf(owner, routineId))[0], "the routine day");
    sessions = await logTwoWeeks(owner, routineDayId);
    // The stranger trains in the same weeks, one day later in each.
    for (const localDate of ["2026-10-07", "2026-10-14"]) {
      const session = await startSession(stranger, localDate);
      await logWorking(stranger, session, `${localDate}T09:00:00Z`, 2);
    }
  });

  it("should list the golden week as 3 sessions, newest first, with the day's name and the sets", async () => {
    const week = await listSessionsInWeek(owner.client, "2026-10-12");

    expect(week.map(({ id }) => id)).toEqual([
      present(sessions["2026-10-15"], "a session"),
      present(sessions["2026-10-13"], "a session"),
      present(sessions["2026-10-12"], "a session"),
    ]);
    expect(week.map(({ sets }) => sets.length)).toEqual([3, 6, 5]);
    expect(week.map(({ routine_day_name }) => routine_day_name)).toEqual([
      dayName,
      dayName,
      dayName,
    ]);
    const [firstSet] = week[0]?.sets ?? [];
    expect(firstSet?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect({ ...firstSet, id: "set" }).toEqual({
      id: "set",
      session_id: present(sessions["2026-10-15"], "a session"),
      exercise_id: exercise.id,
      position: 0,
      set_type: "working",
      rir: 2,
      rpe: null,
      performed_at: "2026-10-15T17:01:00+00:00",
      snapshot: exercise.snapshot,
      deleted_at: null,
    });
  });

  it("should list the week before it as 4 sessions, newest first, with no day name for a free session", async () => {
    const week = await listSessionsInWeek(owner.client, "2026-10-05");

    expect(week.map(({ local_date }) => local_date)).toEqual([
      "2026-10-10",
      "2026-10-08",
      "2026-10-06",
      "2026-10-05",
    ]);
    expect(week.map(({ routine_day_name }) => routine_day_name)).toEqual([null, null, null, null]);
    expect(week.reduce((total, { sets }) => total + sets.length, 0)).toBe(15);
  });

  it("should never list another user's sessions", async () => {
    const [first, second] = await Promise.all([
      listSessionsInWeek(owner.client, "2026-10-05"),
      listSessionsInWeek(owner.client, "2026-10-12"),
    ]);

    expect([...first, ...second].map(({ local_date }) => local_date)).not.toContain("2026-10-07");
    expect([...first, ...second].map(({ local_date }) => local_date)).not.toContain("2026-10-14");
    const strangerWeek = await listSessionsInWeek(stranger.client, "2026-10-05");
    expect(strangerWeek.map(({ local_date }) => local_date)).toEqual(["2026-10-07"]);
  });

  it("should list nothing for a week with no session, and for a user with none", async () => {
    const newcomer = await createTestUser("key387");

    await expect(listSessionsInWeek(owner.client, "2026-09-28")).resolves.toEqual([]);
    await expect(listSessionsInWeek(newcomer.client, "2026-10-12")).resolves.toEqual([]);
  });

  it("should leave out a soft-deleted set and a soft-deleted session", async () => {
    const user = await createTestUser("key387");
    const kept = await startSession(user, "2026-10-12", { startedAt: "2026-10-12T09:00:00Z" });
    const removed = await startSession(user, "2026-10-13", { startedAt: "2026-10-13T09:00:00Z" });
    const [firstSet, secondSet] = await logWorking(user, kept, "2026-10-12T09:00:00Z", 2);
    await logWorking(user, removed, "2026-10-13T09:00:00Z", 2);
    await softDeleteSet(user, present(firstSet, "a set"));
    await softDeleteSession(user, removed);

    const week = await listSessionsInWeek(user.client, "2026-10-12");

    expect(week.map(({ id }) => id)).toEqual([kept]);
    expect(week[0]?.sets.map(({ id }) => id)).toEqual([present(secondSet, "a set")]);
  });

  it("should not show a session deleted through delete_workout_session", async () => {
    const user = await createTestUser("key387");
    const session = await startSession(user, "2026-10-12", { startedAt: "2026-10-12T09:00:00Z" });
    await logWorking(user, session, "2026-10-12T09:00:00Z", 2);
    expect(await listSessionsInWeek(user.client, "2026-10-12")).toHaveLength(1);

    await deleteSession(user.client, session);

    await expect(listSessionsInWeek(user.client, "2026-10-12")).resolves.toEqual([]);
  });

  it("should order two sessions that started at the same moment by id, newest id first", async () => {
    const user = await createTestUser("key387");
    const first = await startSession(user, "2026-10-12", { startedAt: "2026-10-12T09:00:00Z" });
    const second = await startSession(user, "2026-10-12", { startedAt: "2026-10-12T09:00:00Z" });

    const week = await listSessionsInWeek(user.client, "2026-10-12");

    expect(week.map(({ id }) => id)).toEqual([first, second].sort().reverse());
  });
});

describe("findPreviousSessionWeek", () => {
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key387"), createTestUser("key387")]);
    await logTwoWeeks(owner);
    // Newer and older than every session of the owner, so a leak would show in both directions.
    await startSession(stranger, "2026-11-02");
    await startSession(stranger, "2026-08-03");
  });

  it("should give the Monday of the week before the golden week", async () => {
    await expect(findPreviousSessionWeek(owner.client, "2026-10-12")).resolves.toBe("2026-10-05");
  });

  it("should give null before the first week, and never another user's week", async () => {
    await expect(findPreviousSessionWeek(owner.client, "2026-10-05")).resolves.toBeNull();
  });

  it("should give the newest week with a session when no week is given, and not the stranger's", async () => {
    await expect(findPreviousSessionWeek(owner.client)).resolves.toBe("2026-10-12");
  });

  it("should skip a week with nothing logged", async () => {
    await expect(findPreviousSessionWeek(owner.client, "2026-10-26")).resolves.toBe("2026-10-12");
  });

  it("should give null for a user with no session", async () => {
    const newcomer = await createTestUser("key387");

    await expect(findPreviousSessionWeek(newcomer.client, "2026-10-12")).resolves.toBeNull();
    await expect(findPreviousSessionWeek(newcomer.client)).resolves.toBeNull();
  });

  it("should skip a soft-deleted session", async () => {
    const user = await createTestUser("key387");
    await startSession(user, "2026-09-30");
    const removed = await startSession(user, "2026-10-07");
    await softDeleteSession(user, removed);

    await expect(findPreviousSessionWeek(user.client, "2026-10-12")).resolves.toBe("2026-09-28");
  });
});
