// @vitest-environment jsdom
// The hooks need a DOM to render in. The rest of the integration suite runs in node.
import {
  COMPARE_PARAMS_V1,
  TRAINING_PARAMS_V1,
  compareWeek,
  muscleState,
  projectWeek,
  targetedMuscles,
} from "@keylow/core/training";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  dayIdsOf,
  logSets,
  present,
  saveExercise,
  saveRoutine,
  setActiveRoutine,
  softDeleteSet,
  startSession,
} from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { planRoutineOf } from "../../src/hooks/planRoutineOf";
import { useMuscleState } from "../../src/hooks/useMuscleState";
import { useWeekComparison } from "../../src/hooks/useWeekComparison";
import { getActiveRoutine, listSetsFrom, listWeekSessions } from "../../src/repos/training";
import { createWrapper } from "../support/wrapper";

import type { SavedExercise } from "./support/training";
import type { TestUser } from "./support/users";

// The hooks over the real tables with real user JWTs. The profile's time zone is UTC (the column's default).

const NOW = "2026-10-17T12:00:00Z";
const START_DAY = "2026-10-02";
const WEEK_START = "2026-10-12";

let owner: TestUser;
let stranger: TestUser;
let bench: SavedExercise;
let routineDayId: string;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createTestUser("key354"), createTestUser("key354")]);
  bench = await saveExercise(owner, "hooks-bench");
  const routineId = await saveRoutine(owner, null, [
    { weekday: 0, name: "push", exerciseIds: [bench.id], targetSets: 3 },
  ]);
  await setActiveRoutine(owner, routineId);
  routineDayId = present((await dayIdsOf(owner, routineId))[0], "the routine day");

  // Monday's planned session, logged with two sets and one more that was deleted, and an earlier
  // session in the heat window that is outside the week.
  const monday = await startSession(owner, WEEK_START, { routineDayId });
  const [, , removed] = await logSets(owner, monday, bench, [
    { performedAt: "2026-10-12T09:30:00Z" },
    { performedAt: "2026-10-12T09:40:00Z" },
    { performedAt: "2026-10-12T09:50:00Z" },
  ]);
  await softDeleteSet(owner, present(removed, "a set"));
  const earlier = await startSession(owner, "2026-10-08");
  await logSets(owner, earlier, bench, [{ performedAt: "2026-10-08T09:30:00Z" }]);
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("useMuscleState over the real tables", () => {
  it("should give core's heat and volume for the user's own sets, with not_targeted for an untrained muscle", async () => {
    const { wrapper } = createWrapper(owner.client);

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const state = result.current.data;
    // Two live sets in the last 7 days count in full at RIR 2 (a third was deleted). The set of the 8th
    // is older than the volume window, and still inside the heat window with the others.
    expect(state?.chest_lower).toMatchObject({ weeklySets: 2, volumeStatus: "under" });
    expect(state?.lats).toMatchObject({ heat: 0, weeklySets: 0, volumeStatus: "not_targeted" });
    // Core, called directly on the same rows (core is not the code under test here).
    const rows = await listSetsFrom(owner.client, START_DAY, "2026-10-17");
    const routine = await getActiveRoutine(owner.client);
    expect(rows).toHaveLength(3);
    expect(state).toEqual(muscleState(rows, NOW, TRAINING_PARAMS_V1, targetedMuscles({ routine })));
  });

  it("should show another user none of the owner's heat", async () => {
    const { wrapper } = createWrapper(stranger.client);

    const { result } = renderHook(() => useMuscleState(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.chest_lower).toMatchObject({ heat: 0, weeklySets: 0 });
    expect(result.current.data?.triceps).toMatchObject({ heat: 0, weeklySets: 0 });
    // With no routine every muscle is targeted, so an untrained muscle is under and not not_targeted.
    expect(result.current.data?.lats.volumeStatus).toBe("under");
  });
});

describe("useWeekComparison over the real tables", () => {
  it("should compare the logged Monday with the plan, and give what core gives for the same rows", async () => {
    const { wrapper } = createWrapper(owner.client);

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    // The planned Monday is replaced by the two live sets logged on it: two against three planned.
    expect(result.current.data?.chest_lower).toEqual({
      actualWeeklySets: 2,
      projectedWeeklySets: 2,
      gap: 0,
      status: "on_plan",
    });
    const sessions = await listWeekSessions(owner.client, WEEK_START);
    const routine = await getActiveRoutine(owner.client);
    const { actual, projected } = projectWeek(
      present(planRoutineOf(routine, "UTC"), "the routine"),
      WEEK_START,
      "UTC",
      { sessions, sets: sessions.flatMap((session) => session.sets) },
      COMPARE_PARAMS_V1,
    );
    expect(result.current.data).toEqual(compareWeek(actual, projected, COMPARE_PARAMS_V1));
  });

  it("should show another user an empty week", async () => {
    const { wrapper } = createWrapper(stranger.client);

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.chest_lower).toEqual({
      actualWeeklySets: 0,
      projectedWeeklySets: 0,
      gap: 0,
      status: "on_plan",
    });
  });
});
