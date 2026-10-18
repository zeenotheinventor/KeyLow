import { COMPARE_PARAMS_V1, compareWeek, projectWeek } from "@keylow/core/training";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMuscleState } from "../../src/hooks/useMuscleState";
import { useWeekComparison } from "../../src/hooks/useWeekComparison";
import { keys } from "../../src/queryKeys";
import { getActiveRoutine, listWeekSessions } from "../../src/repos/training";
import { createTestClient } from "../createTestClient";
import { installTrainingFake, routineRow, sessionRow, setRow } from "../support/training";
import { createWrapper } from "../support/wrapper";

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

const WEEK_START = "2026-10-12";
const PLANNED_DAY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** A session of the planned Monday with `count` working sets at RIR 2. */
const mondaySession = (count: number, overrides: Record<string, unknown> = {}) => {
  const base = sessionRow({ local_date: WEEK_START, routine_day_id: PLANNED_DAY_ID, ...overrides });
  return {
    ...base,
    workout_sets: Array.from({ length: count }, () =>
      setRow({ session_id: base.id, performed_at: "2026-10-12T17:00:00+00:00" }),
    ),
  };
};

describe("useWeekComparison", () => {
  it("should be behind the plan for a muscle when nothing was logged, and on plan for one the plan does not train", async () => {
    installTrainingFake(server, { sessions: [], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.chest_lower).toEqual({
      actualWeeklySets: 0,
      projectedWeeklySets: 3,
      gap: -3,
      status: "behind",
    });
    expect(result.current.data?.lats).toEqual({
      actualWeeklySets: 0,
      projectedWeeklySets: 0,
      gap: 0,
      status: "on_plan",
    });
  });

  it("should replace the planned day with the logged one, so a logged day is on plan", async () => {
    installTrainingFake(server, { sessions: [mondaySession(3)], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.chest_lower).toEqual({
      actualWeeklySets: 3,
      projectedWeeklySets: 3,
      gap: 0,
      status: "on_plan",
    });
  });

  it("should count a session with no routine day as actual only, so the user is ahead", async () => {
    const extra = mondaySession(5, { routine_day_id: null, local_date: "2026-10-14" });
    installTrainingFake(server, { sessions: [extra], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.chest_lower).toEqual({
      actualWeeklySets: 5,
      projectedWeeklySets: 3,
      gap: 2,
      status: "ahead",
    });
  });

  it("should compare against an empty plan when the user has no active routine", async () => {
    installTrainingFake(server, { sessions: [mondaySession(2)], routine: null });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.chest_lower).toMatchObject({
      actualWeeklySets: 2,
      projectedWeeklySets: 0,
      status: "ahead",
    });
  });

  it("should give what core gives for the same rows (core is not the code under test here)", async () => {
    installTrainingFake(server, {
      sessions: [
        mondaySession(2),
        mondaySession(4, { local_date: "2026-10-15", routine_day_id: null }),
      ],
      routine: routineRow(),
    });
    const { wrapper } = createWrapper();
    const client = createTestClient();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const sessions = await listWeekSessions(client, WEEK_START);
    const routine = await getActiveRoutine(client);
    const { actual, projected } = projectWeek(
      routine ?? { days: [] },
      WEEK_START,
      "Europe/London",
      { sessions, sets: sessions.flatMap((session) => session.sets) },
      COMPARE_PARAMS_V1,
    );
    expect(result.current.data).toEqual(compareWeek(actual, projected, COMPARE_PARAMS_V1));
  });

  it("should store the sessions and their sets as rows under the week key, and nothing derived", async () => {
    installTrainingFake(server, { sessions: [mondaySession(2)], routine: routineRow() });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const stored = queryClient.getQueryData(keys.training.weekSessions(WEEK_START));
    expect(stored).toEqual([
      expect.objectContaining({
        local_date: WEEK_START,
        sets: [expect.anything(), expect.anything()],
      }),
    ]);
    expect(JSON.stringify(stored)).not.toMatch(/projectedWeeklySets|actualWeeklySets|status/);
  });

  it("should read the routine once for the week and the heat together", async () => {
    const fake = installTrainingFake(server, { sessions: [], sets: [], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => [useWeekComparison(WEEK_START), useMuscleState("2026-10-17T12:00:00Z")] as const,
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current[0].data).toBeDefined();
      expect(result.current[1].data).toBeDefined();
    });
    expect(fake.requestsTo("routines")).toHaveLength(1);
  });

  it("should make no request at all while enabled is false", async () => {
    const fake = installTrainingFake(server, { sessions: [], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START, { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
  });

  it("should fail without asking for sessions, and not retry, when the date is not a Monday", async () => {
    const fake = installTrainingFake(server, { sessions: [], routine: routineRow() });
    const { wrapper } = createWrapper(undefined, { retryDelayMs: 20 });

    const { result } = renderHook(() => useWeekComparison("2026-10-14"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.error).toBeInstanceOf(RangeError);
    expect(fake.requestsTo("workout_sessions")).toEqual([]);
  });

  it("should report the failure of the sessions read, naming the action and the code only", async () => {
    const fake = installTrainingFake(server, { sessions: [], routine: routineRow() });
    fake.failWith("42501", "workout_sessions");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your week (42501)");
  });

  it("should report the failure of the routine read", async () => {
    const fake = installTrainingFake(server, { sessions: [], routine: routineRow() });
    fake.failWith("42501", "routines");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeekComparison(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your routine (42501)");
  });
});
