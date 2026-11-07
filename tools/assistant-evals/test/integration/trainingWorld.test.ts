import { getActiveSession, getCurrentTrainingGoals, listSessionsInWeek } from "@keylow/api-client";
import { MUSCLE_IDS } from "@keylow/core/training";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { CURRENT_GOAL, trainingSessions } from "../../fixtures/training.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";
import { LIVE_WORKOUT, createTrainingWorld, mondayOf } from "../../src/trainingWorld.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";
import type { TrainingWorld } from "../../src/trainingWorld.ts";

// These need the local stack with its migrations, as the other integration tests do. The user is new for the
// run, and afterAll removes it. The tests go in order: each leaves the user as the next one expects it.
const RUN_ID = crypto.randomUUID().slice(0, 8);

// Eighteen sessions of about forty sets are written one request at a time.
const WRITING_TIMEOUT_MS = 180_000;
const UNKNOWN_EXERCISE_ID = "00000000-0000-4000-8000-000000000000";

let user: FixtureUser;
let world: TrainingWorld;
let now: string;

beforeAll(async () => {
  user = await createFixtureUser(inject("stack"), { namePrefix: `key895-${RUN_ID}` });
  world = createTrainingWorld(user);
  now = new Date().toISOString();
  await world.ensureHistory();
}, WRITING_TIMEOUT_MS);

afterAll(async () => {
  await user.remove();
});

const countSessions = async (): Promise<number> => {
  const { count, error } = await user.client
    .from("workout_sessions")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Could not count the sessions (${error.code})`);
  }
  return count ?? 0;
};

describe("the history", () => {
  it("should write every planned session once, whatever the number of calls", async () => {
    await world.ensureHistory();

    expect(await countSessions()).toBe(trainingSessions().length);
    expect(await getActiveSession(user.client)).toBeNull();
  });

  it("should name the exercises it knows by their ids, and no other", async () => {
    const ids = await world.exerciseIds();
    const bench = ids.get("benchPress");

    expect(bench).toBeDefined();
    expect(await world.exerciseName(bench ?? "")).toBe("Barbell Bench Press - Medium Grip");
    expect(await world.exerciseName(UNKNOWN_EXERCISE_ID)).toBeNull();
  });
});

describe("what the tools would answer", () => {
  it("should give a muscle row for each muscle and the sets of an area", async () => {
    const whole = await world.muscleFacts(null, now);
    const back = await world.muscleFacts("back", now);

    expect(whole.rows).toHaveLength(MUSCLE_IDS.length);
    expect(whole.area).toBeNull();
    expect(back.area?.target).toBeGreaterThan(0);
    expect(back.rows.length).toBeGreaterThan(0);
    expect(back.rows.length).toBeLessThan(whole.rows.length);
  });

  it("should give a session for the day the Today card picks, within the minutes asked", async () => {
    const open = await world.suggestion({ minutes: null, equipment: null }, now);
    const short = await world.suggestion({ minutes: 30, equipment: null }, now);

    expect(open.kind).not.toBe("none");
    if (open.kind === "session") {
      expect(open.sets).toBeGreaterThan(0);
      expect(open.exerciseSets.length).toBeGreaterThan(0);
    }
    if (short.kind === "session") {
      expect(short.minutes).toBeLessThanOrEqual(30);
    }
  });
});

describe("a missing goal", () => {
  it("should close the goal, leave no suggestion, and save the same goal again", async () => {
    await world.clearGoal();

    expect(await getCurrentTrainingGoals(user.client)).toBeNull();
    expect(await world.suggestion({ minutes: null, equipment: null }, now)).toEqual({
      kind: "none",
    });
    await expect(world.clearGoal()).rejects.toThrow(/closed 0/);

    await world.restoreGoal();
    await world.restoreGoal();

    expect(await getCurrentTrainingGoals(user.client)).toMatchObject({
      goal: CURRENT_GOAL.goal,
      session_minutes: CURRENT_GOAL.session_minutes,
    });
  });
});

describe("a workout in progress", () => {
  it("should start with the sets of the live workout, count in the muscles, and give no suggestion", async () => {
    const before = await world.muscleFacts("chest", new Date().toISOString());
    await world.startWorkout();

    const live = await getActiveSession(user.client);
    const after = await world.muscleFacts("chest", new Date().toISOString());

    expect(live?.sets).toHaveLength(LIVE_WORKOUT.sets);
    expect(live?.sets.every(({ load_kg }) => load_kg === LIVE_WORKOUT.loadKg)).toBe(true);
    expect(after.area?.sets).toBeGreaterThan(before.area?.sets ?? 0);
    expect(await world.suggestion({ minutes: null, equipment: null }, now)).toEqual({
      kind: "none",
    });
  });

  it("should delete the workout, once or twice, and leave the history as it was", async () => {
    await world.discardWorkout();
    await world.discardWorkout();

    expect(await getActiveSession(user.client)).toBeNull();
    expect(await countSessions()).toBe(trainingSessions().length);
    expect(
      (await listSessionsInWeek(user.client, mondayOf(user.anchorDate))).every(
        ({ ended_at }) => ended_at !== null,
      ),
    ).toBe(true);
  });
});
