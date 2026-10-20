import { onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useExerciseTrendSets } from "../../src/hooks/useExerciseTrendSets";
import { keys } from "../../src/queryKeys";
import {
  TREND_EXERCISE_ID,
  TREND_OTHER_EXERCISE_ID,
  TREND_RECOGNISABLE_EXERCISE_NAME,
  TREND_RECOGNISABLE_LOAD,
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

describe("useExerciseTrendSets", () => {
  it("should load the exercise's sets and the earlier week, and keep the rows under its key", async () => {
    installTrendFake(server, {
      sets: [trendRow()],
      earlier: [trendRow({ workout_sessions: { local_date: "2026-09-10", deleted_at: null } })],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExerciseTrendSets(TREND_EXERCISE_ID, "4w", { now: NOW }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual({
      sets: [trendSetOf("2026-10-20")],
      earlier: [trendSetOf("2026-09-10")],
    });
    expect(
      queryClient.getQueryData(keys.training.exerciseTrend(TREND_EXERCISE_ID, "2026-09-28")),
    ).toEqual(result.current.data);
  });

  it("should read a profile with no time zone as UTC, as every other screen does", async () => {
    // 00:30 on Monday 26 October is already the new week in UTC, where a zone behind UTC would still read Sunday.
    const fake = installTrendFake(server, { timeZone: null });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExerciseTrendSets(TREND_EXERCISE_ID, "4w", { now: "2026-10-26T00:30:00Z" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(
      fake.rangeRequests()[0]?.searchParams.getAll("workout_sessions.local_date").sort(),
    ).toEqual(["gte.2026-10-05", "lte.2026-10-26"]);
  });

  it.each([
    ["4w", "2026-09-28"],
    ["3m", "2026-07-27"],
    ["1y", "2025-10-27"],
  ] as const)(
    "should read the %s range from the Monday %s through today",
    async (range, fromWeek) => {
      const fake = installTrendFake(server);
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useExerciseTrendSets(TREND_EXERCISE_ID, range, { now: NOW }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(
        fake.rangeRequests()[0]?.searchParams.getAll("workout_sessions.local_date").sort(),
      ).toEqual([`gte.${fromWeek}`, "lte.2026-10-20"]);
    },
  );

  it("should read today in the profile zone", async () => {
    const fake = installTrendFake(server, { timeZone: "Pacific/Auckland" });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExerciseTrendSets(TREND_EXERCISE_ID, "4w", { now: "2026-10-18T23:30:00Z" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.rangeRequests()[0]?.searchParams.getAll("workout_sessions.local_date")).toContain(
      "lte.2026-10-19",
    );
  });

  it("should make no request while enabled is false or there is no exercise", async () => {
    const fake = installTrendFake(server);
    const { wrapper } = createWrapper();

    renderHook(() => useExerciseTrendSets(TREND_EXERCISE_ID, "4w", { now: NOW, enabled: false }), {
      wrapper,
    });
    const { result } = renderHook(() => useExerciseTrendSets(undefined, "4w", { now: NOW }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current.isPending).toBe(true);
  });

  it("should report an error that names the action and the code only", async () => {
    const fake = installTrendFake(server);
    fake.failWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExerciseTrendSets(TREND_EXERCISE_ID, "4w", { now: NOW }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const text = JSON.stringify({
      message: result.current.error?.message,
      cause: result.current.error?.cause,
    });
    expect(result.current.error?.message).toBe("Could not load your trend (42501)");
    expect(text).not.toContain(TREND_RECOGNISABLE_EXERCISE_NAME);
    expect(text).not.toContain(String(TREND_RECOGNISABLE_LOAD));
  });

  it("should fail at once, not retried, for an id that is not a UUID", async () => {
    const fake = installTrendFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseTrendSets("bench", "4w", { now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
    expect(fake.rangeRequests()).toEqual([]);
  });

  describe("in a later week than the rows were read", () => {
    const earlierRows = { sets: [trendSetOf("2026-10-06")], earlier: [] };
    const OFFLINE_NOW = "2026-10-27T12:00:00Z"; // the range starts on Monday 5 Oct

    const renderOffline = (
      cached: Record<string, typeof earlierRows>,
      exerciseId = TREND_EXERCISE_ID,
    ) => {
      onlineManager.setOnline(false);
      const fake = installTrendFake(server);
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      for (const [fromWeek, rows] of Object.entries(cached)) {
        queryClient.setQueryData(keys.training.exerciseTrend(TREND_EXERCISE_ID, fromWeek), rows);
      }
      const hook = renderHook(() => useExerciseTrendSets(exerciseId, "4w", { now: OFFLINE_NOW }), {
        wrapper,
      });
      return { fake, ...hook };
    };

    it("should show the rows cached for an earlier start while there is no connection", async () => {
      const { result, fake } = renderOffline({ "2026-09-28": earlierRows });

      await waitFor(() => {
        expect(result.current.data).toEqual(earlierRows);
      });
      expect(result.current.isPending).toBe(false);
      expect(fake.requests).toEqual([]);
    });

    it("should use the rows of the newest earlier start when several are cached", async () => {
      const newer = { sets: [trendSetOf("2026-10-13")], earlier: [] };
      const { result } = renderOffline({
        "2026-09-14": earlierRows,
        "2026-09-28": newer,
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(newer);
      });
    });

    it("should not use rows cached for a start after this one, which cover fewer of the weeks", async () => {
      const { result } = renderOffline({ "2026-10-12": earlierRows });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current.data).toBeUndefined();
      expect(result.current.isPending).toBe(true);
    });

    it("should not use the rows of another exercise", async () => {
      const { result } = renderOffline({ "2026-09-28": earlierRows }, TREND_OTHER_EXERCISE_ID);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current.data).toBeUndefined();
    });

    it("should swap the stand-in rows for this week's once there is a connection", async () => {
      installTrendFake(server, {
        sets: [trendRow({ workout_sessions: { local_date: "2026-10-27" } })],
      });
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
      queryClient.setQueryData(
        keys.training.exerciseTrend(TREND_EXERCISE_ID, "2026-09-28"),
        earlierRows,
      );

      const { result } = renderHook(
        () => useExerciseTrendSets(TREND_EXERCISE_ID, "4w", { now: OFFLINE_NOW }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.data?.sets).toEqual([trendSetOf("2026-10-27")]);
      });
    });
  });
});
