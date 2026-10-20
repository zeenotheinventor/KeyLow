import { onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRoutineTrendSets } from "../../src/hooks/useRoutineTrendSets";
import { keys } from "../../src/queryKeys";
import { routineDetailRowSchema } from "../../src/repos/routineSchemas";
import { refreshRoutines } from "../../src/routineCache";
import {
  DAY_ID,
  OTHER_ROUTINE_ID,
  ROUTINE_ID,
  plannedExerciseRow,
  routineDetailRow,
} from "../support/routines";
import {
  TREND_EXERCISE_ID,
  TREND_OTHER_EXERCISE_ID,
  installTrendFake,
  trendRow,
  trendSetOf,
} from "../support/trend";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

const NOW = "2026-10-20T12:00:00Z";

const parseRoutine = (row: unknown) => routineDetailRowSchema.parse(row);

const oneDayWith = (exerciseId: string) => ({
  id: DAY_ID,
  position: 0,
  weekday: 0,
  name: "Push",
  routine_exercises: [
    plannedExerciseRow({
      exercise_id: exerciseId,
      exercises: { id: exerciseId, name: "Press", equipment: "barbell" },
    }),
  ],
});

const routineOfTwoDays = routineDetailRow({
  routine_days: [
    {
      id: DAY_ID,
      position: 0,
      weekday: 0,
      name: "Push",
      routine_exercises: [plannedExerciseRow()],
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-dddddddddddd",
      position: 1,
      weekday: null,
      name: "Pull",
      routine_exercises: [
        plannedExerciseRow({
          id: "dddddddd-dddd-4ddd-8ddd-eeeeeeeeeeee",
          exercise_id: TREND_OTHER_EXERCISE_ID,
          exercises: { id: TREND_OTHER_EXERCISE_ID, name: "Row", equipment: "cable" },
        }),
        // The exercise of the first day again: asked for once.
        plannedExerciseRow({ id: "dddddddd-dddd-4ddd-8ddd-ffffffffffff", position: 1 }),
      ],
    },
  ],
});

describe("useRoutineTrendSets", () => {
  it("should read the sets of every exercise of the routine in one request, and keep the rows under its key", async () => {
    const fake = installTrendFake(server, {
      routine: routineOfTwoDays,
      sets: [trendRow(), trendRow({ exercise_id: TREND_OTHER_EXERCISE_ID })],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutineTrendSets(ROUTINE_ID, "4w", { now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.rangeRequests()).toHaveLength(1);
    expect(fake.rangeRequests()[0]?.searchParams.get("exercise_id")).toBe(
      `in.(${TREND_EXERCISE_ID},${TREND_OTHER_EXERCISE_ID})`,
    );
    expect(result.current.data?.sets).toEqual([
      trendSetOf("2026-10-20"),
      trendSetOf("2026-10-20", {}, TREND_OTHER_EXERCISE_ID),
    ]);
    expect(queryClient.getQueryData(keys.training.routineTrend(ROUTINE_ID, "2026-09-28"))).toEqual(
      result.current.data,
    );
  });

  it("should give no rows and make no trend request for a routine that is not there", async () => {
    const fake = installTrendFake(server, { routine: undefined });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutineTrendSets(ROUTINE_ID, "4w", { now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ sets: [], earlier: [] });
    });
    expect(fake.requests).toEqual([]);
  });

  it("should make no request while enabled is false or there is no routine", async () => {
    const fake = installTrendFake(server, { routine: routineOfTwoDays });
    const { wrapper } = createWrapper();

    renderHook(() => useRoutineTrendSets(ROUTINE_ID, "4w", { now: NOW, enabled: false }), {
      wrapper,
    });
    renderHook(() => useRoutineTrendSets(undefined, "4w", { now: NOW }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
  });

  it("should report an error that names the action and the code only when the sets cannot be read", async () => {
    const fake = installTrendFake(server, { routine: routineOfTwoDays });
    fake.failWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutineTrendSets(ROUTINE_ID, "4w", { now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your trend (42501)");
  });

  it("should read the exercises of the routine as it is cached when the read is refreshed after a save", async () => {
    const fake = installTrendFake(server, { routine: routineOfTwoDays, sets: [trendRow()] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useRoutineTrendSets(ROUTINE_ID, "4w", { now: NOW }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.rangeRequests()[0]?.searchParams.get("exercise_id")).toBe(
      `in.(${TREND_EXERCISE_ID},${TREND_OTHER_EXERCISE_ID})`,
    );

    // A save puts the routine as stored in the cache, then marks the routines and their trends stale.
    queryClient.setQueryData(
      keys.training.routine(ROUTINE_ID),
      parseRoutine(routineDetailRow({ routine_days: [oneDayWith(TREND_EXERCISE_ID)] })),
    );
    refreshRoutines(queryClient);

    await waitFor(() => {
      expect(fake.rangeRequests()).toHaveLength(2);
    });
    expect(fake.rangeRequests()[1]?.searchParams.get("exercise_id")).toBe(
      `in.(${TREND_EXERCISE_ID})`,
    );
  });

  describe("in a later week than the rows were read", () => {
    const cachedRows = { sets: [trendSetOf("2026-10-06")], earlier: [] };

    it("should show the rows of the newest earlier start while there is no connection", async () => {
      onlineManager.setOnline(false);
      const fake = installTrendFake(server);
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(keys.training.routineTrend(ROUTINE_ID, "2026-09-28"), cachedRows);

      const { result } = renderHook(
        () => useRoutineTrendSets(ROUTINE_ID, "4w", { now: "2026-10-27T12:00:00Z" }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(cachedRows);
      });
      expect(fake.requests).toEqual([]);
    });

    it("should not use the rows of another routine or of a later start", async () => {
      onlineManager.setOnline(false);
      installTrendFake(server);
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(
        keys.training.routineTrend(OTHER_ROUTINE_ID, "2026-09-28"),
        cachedRows,
      );
      queryClient.setQueryData(keys.training.routineTrend(ROUTINE_ID, "2026-10-12"), cachedRows);

      const { result } = renderHook(
        () => useRoutineTrendSets(ROUTINE_ID, "4w", { now: "2026-10-27T12:00:00Z" }),
        { wrapper },
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current.data).toBeUndefined();
    });
  });
});
