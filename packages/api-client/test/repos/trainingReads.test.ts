import { currentMuscleState } from "@keylow/core/training";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { readMuscleState, readTrainingInputs } from "../../src/repos/trainingReads";
import { createTestClient } from "../createTestClient";
import {
  RECOGNISABLE_EXERCISE_NAME,
  ROUTINE_ID,
  installTrainingFake,
  routineRow,
  setRow,
} from "../support/training";
import { GOAL_ROW_ID, trainingGoalsRow } from "../support/trainingGoals";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const firstSetsRequest = (fake: ReturnType<typeof installTrainingFake>) =>
  fake.requestsTo("workout_sets")[0]?.url ?? new URL("http://none");

describe("readTrainingInputs", () => {
  it("should read the sets of the heat window, the active routine and the current goal", async () => {
    const row = setRow();
    installTrainingFake(server, {
      sets: [row],
      routine: routineRow(),
      goal: trainingGoalsRow(),
    });

    const inputs = await readTrainingInputs(createTestClient(), { today: "2026-10-18" });

    expect(inputs.sets.map((set) => set.id)).toEqual([row.id]);
    expect(inputs.activeRoutine?.id).toBe(ROUTINE_ID);
    expect(inputs.goal?.id).toBe(GOAL_ROW_ID);
  });

  it("should read the sets from the day 15 days before today, through today", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });

    await readTrainingInputs(createTestClient(), { today: "2026-10-18" });

    expect(firstSetsRequest(fake).searchParams.getAll("workout_sessions.local_date")).toEqual([
      "gte.2026-10-03",
      "lte.2026-10-18",
    ]);
  });

  it("should give no routine and no goal when the user has neither", async () => {
    installTrainingFake(server, { sets: [] });

    const inputs = await readTrainingInputs(createTestClient(), { today: "2026-10-18" });

    expect(inputs).toEqual({ sets: [], activeRoutine: null, goal: null });
  });

  it("should name the action and the error code only when a read fails", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()], goal: trainingGoalsRow() });
    fake.failWith("23514", "training_goals");

    const error = await readTrainingInputs(createTestClient(), { today: "2026-10-18" }).then(
      () => null,
      (rejection: unknown) => (rejection instanceof Error ? rejection : null),
    );

    expect(error?.message).toBe("Could not load your training goals (23514)");
    expect(JSON.stringify({ message: error?.message, cause: error?.cause })).not.toContain(
      RECOGNISABLE_EXERCISE_NAME,
    );
  });

  it("should refuse a today that is not a calendar date before any request", async () => {
    const fake = installTrainingFake(server);

    await expect(readTrainingInputs(createTestClient(), { today: "18 October" })).rejects.toThrow(
      RangeError,
    );
    expect(fake.requests).toEqual([]);
  });
});

describe("readMuscleState", () => {
  const now = "2026-10-17T08:00:00Z";

  it("should give core's muscle state of the sets read, at the moment given", async () => {
    const row = setRow();
    installTrainingFake(server, { sets: [row] });

    const state = await readMuscleState(createTestClient(), { now, timeZone: "UTC" });

    const [set] = await readTrainingInputs(createTestClient(), { today: "2026-10-17" }).then(
      ({ sets }) => sets,
    );
    expect(state).toEqual(currentMuscleState(set ? [set] : [], now));
    expect(state.chest_lower.weeklySets).toBeGreaterThan(0);
  });

  it("should read the window from the day the moment falls on in the user's zone", async () => {
    const fake = installTrainingFake(server, { sets: [] });

    // 23:30 UTC on the 18th is already the 19th in Auckland (UTC+13 in October).
    await readMuscleState(createTestClient(), {
      now: "2026-10-18T23:30:00Z",
      timeZone: "Pacific/Auckland",
    });

    expect(firstSetsRequest(fake).searchParams.getAll("workout_sessions.local_date")).toEqual([
      "gte.2026-10-04",
      "lte.2026-10-19",
    ]);
  });

  it("should read the sets and nothing else, since the plan does not change a volume status", async () => {
    const fake = installTrainingFake(server, {
      sets: [setRow()],
      routine: routineRow(),
      goal: trainingGoalsRow(),
    });

    await readMuscleState(createTestClient(), { now, timeZone: "UTC" });

    expect(fake.requestsTo("routines")).toEqual([]);
    expect(fake.requestsTo("training_goals")).toEqual([]);
  });

  it("should name the action and the error code only when the sets cannot be read", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });
    fake.failWith("23514");

    await expect(readMuscleState(createTestClient(), { now, timeZone: "UTC" })).rejects.toThrow(
      "Could not load your sets (23514)",
    );
  });
});
