import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useHistoryWeek } from "../../src/hooks/useHistoryWeek";
import { keys } from "../../src/queryKeys";
import { goldenRoutine } from "../support/goldenWeekRows";
import {
  goldenHistorySessions,
  historySessionRow,
  historySetRow,
  installHistoryFake,
} from "../support/history";
import { RECOGNISABLE_EXERCISE_NAME } from "../support/training";
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

const GOLDEN_WEEK = "2026-10-12";

describe("useHistoryWeek", () => {
  it("should give the golden week's sessions newest first with the totals of the summaries", async () => {
    installHistoryFake(server, { sessions: goldenHistorySessions, routine: goldenRoutine });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const sessions = result.current.data ?? [];
    expect(sessions.map(({ local_date }) => local_date)).toEqual([
      "2026-10-15",
      "2026-10-13",
      "2026-10-12",
    ]);
    expect(sessions.map(({ summary }) => summary.titleSource)).toEqual(["Legs", "Pull", "Push"]);
    expect(sessions.map(({ summary }) => summary.workingSets)).toEqual([8, 17, 16]);
    expect(sessions.map(({ summary }) => summary.warmupSets)).toEqual([2, 1, 1]);
    expect(sessions.map(({ summary }) => summary.durationMinutes)).toEqual([null, 51, 48]);
    expect(sessions.map(({ summary }) => summary.topMuscles)).toEqual([
      ["hamstrings", "quads", "glute_max"],
      ["lats", "biceps", "traps_mid"],
      ["triceps", "delt_front", "delt_side"],
    ]);
  });

  it("should read no routine, so a summary compares nothing with the plan", async () => {
    const fake = installHistoryFake(server, {
      sessions: goldenHistorySessions,
      routine: goldenRoutine,
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.requestsTo("routines")).toEqual([]);
    expect(result.current.data?.every(({ summary }) => !("planComparison" in summary))).toBe(true);
  });

  it("should keep the stored rows free of summaries, so a summary is never stale", async () => {
    installHistoryFake(server, { sessions: goldenHistorySessions, routine: goldenRoutine });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const stored = queryClient.getQueryData<object[]>(keys.training.history(GOLDEN_WEEK));
    expect(stored).toHaveLength(3);
    expect(stored?.every((row) => !("summary" in row))).toBe(true);
  });

  it("should give a free session no title", async () => {
    installHistoryFake(server, {
      sessions: [historySessionRow({ local_date: GOLDEN_WEEK })],
      routine: goldenRoutine,
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.[0]?.summary).toMatchObject({
      titleSource: null,
      workingSets: 1,
    });
  });

  it("should keep the day's name for a day that is not in the active routine", async () => {
    installHistoryFake(server, {
      sessions: [
        historySessionRow({
          local_date: GOLDEN_WEEK,
          routine_day_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          routine_days: { name: "An old day" },
          workout_sets: [historySetRow({ position: 0 })],
        }),
      ],
      routine: goldenRoutine,
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.[0]?.summary.titleSource).toBe("An old day");
  });

  it("should give an empty list for a week with nothing logged", async () => {
    installHistoryFake(server, { sessions: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
    expect(result.current.isPending).toBe(false);
  });

  it("should give the sessions whatever the state of the routine, since it never reads it", async () => {
    const fake = installHistoryFake(server, { sessions: goldenHistorySessions });
    fake.failWith("42501", "routines");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(3);
    });
    expect(fake.requestsTo("routines")).toEqual([]);
  });

  it("should make no request at all when it is not enabled", async () => {
    const fake = installHistoryFake(server, { sessions: goldenHistorySessions });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK, { enabled: false }), {
      wrapper,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fake.requests).toEqual([]);
    expect(result.current.data).toBeUndefined();
  });

  it("should fail without a request, and without a retry, for a date that is not a Monday", async () => {
    const fake = installHistoryFake(server, { sessions: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek("2026-10-14"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
    expect(fake.requestsTo("workout_sessions")).toEqual([]);
  });

  it("should report an error that names the action and the code only when the read fails", async () => {
    const fake = installHistoryFake(server, { sessions: goldenHistorySessions });
    fake.failWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistoryWeek(GOLDEN_WEEK), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your history (42501)");
    expect(
      JSON.stringify([result.current.error?.message, result.current.error?.cause]),
    ).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});
