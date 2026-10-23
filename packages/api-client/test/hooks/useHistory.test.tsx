import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useHistory } from "../../src/hooks/useHistory";
import { keys } from "../../src/queryKeys";
import { refreshSessions } from "../../src/sessionCache";
import { goldenRoutine } from "../support/goldenWeekRows";
import {
  goldenHistorySessions,
  historySessionRow,
  installHistoryFake,
  madeUpEarlierWeek,
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

const twoWeeks = [...madeUpEarlierWeek, ...goldenHistorySessions];

describe("useHistory", () => {
  it("should list the golden week and the week before it as 3 and 4 sessions, newest first, with their totals", async () => {
    installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 2 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    const weeks = result.current.data ?? [];
    expect(weeks.map((week) => [week.weekStart, week.sessionCount, week.workingSetTotal])).toEqual([
      ["2026-10-12", 3, 41],
      ["2026-10-05", 4, 63],
    ]);
    expect(weeks[0]?.sessions.map(({ local_date }) => local_date)).toEqual([
      "2026-10-15",
      "2026-10-13",
      "2026-10-12",
    ]);
    expect(weeks[1]?.sessions.map(({ local_date }) => local_date)).toEqual([
      "2026-10-10",
      "2026-10-08",
      "2026-10-06",
      "2026-10-05",
    ]);
  });

  it("should summarise without the plan, and read no routine, since the list shows no plan comparison", async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.data?.[0]?.sessions.map(({ summary }) => summary.planComparison)).toEqual(
      [null, null, null],
    );
    expect(fake.requestsTo("routines")).toEqual([]);
  });

  it("should give each session its summary", async () => {
    installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.data?.[0]?.sessions.map(({ summary }) => summary.workingSets)).toEqual([
      8, 17, 16,
    ]);
    expect(result.current.data?.[0]?.sessions.map(({ summary }) => summary.titleSource)).toEqual([
      "Legs",
      "Pull",
      "Push",
    ]);
  });

  it("should load only the newest week when one week is asked for, and the next one when asked to", async () => {
    installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 1 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.hasEarlierWeeks).toBe(true);

    await act(() => result.current.loadEarlierWeeks());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(result.current.data?.[1]?.weekStart).toBe("2026-10-05");
    expect(result.current.hasEarlierWeeks).toBe(false);
  });

  it("should skip the weeks with nothing logged, so the list never pages an empty week", async () => {
    const lastMonth = historySessionRow({ local_date: "2026-09-02" });
    const fake = installHistoryFake(server, {
      sessions: [...goldenHistorySessions, lastMonth],
      routine: goldenRoutine,
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 2 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(result.current.data?.map(({ weekStart }) => weekStart)).toEqual([
      "2026-10-12",
      "2026-08-31",
    ]);
    expect(result.current.hasEarlierWeeks).toBe(false);
    expect(fake.requestsTo("workout_sessions").length).toBeGreaterThan(0);
  });

  it("should list no weeks, and no next page, for an empty database", async () => {
    installHistoryFake(server, { sessions: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 4 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
    expect(result.current.hasEarlierWeeks).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it("should stop loading weeks when there are fewer than asked for", async () => {
    const fake = installHistoryFake(server, { sessions: goldenHistorySessions });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 4 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.hasEarlierWeeks).toBe(false);
    const sessionReads = fake
      .requestsTo("workout_sessions")
      .filter(({ url }) => url.searchParams.get("select") !== "local_date,workout_sets!inner(id)");
    expect(sessionReads).toHaveLength(1);
  });

  it("should store rows under a key of fixed words, and no summary", async () => {
    installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 2 }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    const stored = queryClient.getQueryData<{
      pages: { sessions: object[] }[];
      pageParams: unknown[];
    }>(keys.training.historyList);
    expect(stored?.pages).toHaveLength(2);
    // The first page asks for the newest week with a session, so the stored cache holds no clock.
    expect(stored?.pageParams[0]).toBeNull();
    for (const pageParam of stored?.pageParams.slice(1) ?? []) {
      expect(pageParam).toBe("2026-10-05");
    }
    expect(stored?.pages.flatMap(({ sessions }) => sessions)).toHaveLength(7);
    expect(
      stored?.pages.every(({ sessions }) => sessions.every((row) => !("summary" in row))),
    ).toBe(true);
  });

  it("should make no request at all when it is not enabled", async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 2, enabled: false }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fake.requests).toEqual([]);
    expect(result.current.data).toBeUndefined();
  });

  it("should drop a session deleted elsewhere, and the week it leaves empty, once the sessions are refreshed", async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useHistory({ weeks: 2 }), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    fake.replaceSessions(twoWeeks.filter(({ local_date }) => !local_date.startsWith("2026-10-1")));
    act(() => {
      refreshSessions(queryClient);
    });

    await waitFor(() => {
      expect(result.current.data?.map(({ weekStart }) => weekStart)).toEqual(["2026-10-05"]);
    });
  });

  it("should report an error that names the action and the code only when the first read fails", async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks });
    fake.failWith("42501", "workout_sessions");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHistory({ weeks: 2 }), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your history (42501)");
    expect(
      JSON.stringify([result.current.error?.message, result.current.error?.cause]),
    ).not.toContain(RECOGNISABLE_EXERCISE_NAME);
    expect(result.current.data).toBeUndefined();
  });

  it("should keep the weeks already on screen when a later page fails", async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useHistory({ weeks: 1 }), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    fake.failWith("42501", "workout_sessions");
    await act(async () => {
      await expect(result.current.loadEarlierWeeks()).rejects.toThrow();
    });

    await waitFor(() => {
      expect(result.current.isLoadingEarlierWeeks).toBe(false);
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.isError).toBe(false);
  });

  it("should reject with an error that names the action and the code only when the page asked for fails", async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useHistory({ weeks: 1 }), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    fake.failWith("42501", "workout_sessions");
    let failure: unknown;
    await act(async () => {
      failure = await result.current.loadEarlierWeeks().catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });
});
