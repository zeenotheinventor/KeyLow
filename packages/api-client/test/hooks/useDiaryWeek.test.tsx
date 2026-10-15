import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDiaryWeek } from "../../src/hooks/useDiaryWeek";
import { keys } from "../../src/queryKeys";
import { dayLogRow, dayTotalsRow } from "../support/diary";
import { answerTable } from "../support/diaryServer";
import { REST_URL, postgrestError } from "../support/postgrest";
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

const answerWeek = () => {
  const dayLogs = answerTable("day_logs", [dayLogRow({ local_date: "2026-10-14" })]);
  const dayTotals = answerTable("day_totals", [dayTotalsRow({ local_date: "2026-10-14" })]);
  server.use(dayLogs.handler, dayTotals.handler);
  return [dayLogs.counter, dayTotals.counter];
};

describe("useDiaryWeek", () => {
  it("should load seven days from the Monday, with the complete one marked by its day log", async () => {
    answerWeek();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryWeek("2026-10-12"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(7);
    expect(result.current.data?.map((day) => day.dayLog?.is_complete ?? false)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(result.current.data?.[2]?.totals).toEqual(dayTotalsRow({ local_date: "2026-10-14" }));
  });

  it("should cache the week under the week key", async () => {
    answerWeek();
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryWeek("2026-10-12"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.diary.week("2026-10-12"))).toEqual(result.current.data);
  });

  it("should make no request while enabled is false", async () => {
    const counters = answerWeek();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryWeek("2026-10-12", { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counters.map((counter) => counter.requests)).toEqual([0, 0]);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should load once enabled turns true", async () => {
    answerWeek();
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ enabled }) => useDiaryWeek("2026-10-12", { enabled }),
      { wrapper, initialProps: { enabled: false } },
    );
    expect(result.current.fetchStatus).toBe("idle");

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should fail without asking when the date is not a Monday", async () => {
    const counters = answerWeek();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryWeek("2026-10-14"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(counters.map((counter) => counter.requests)).toEqual([0, 0]);
  });

  it("should not retry a date that is not a Monday, since asking again cannot change the answer", async () => {
    answerWeek();
    const { wrapper } = createWrapper(undefined, { retryDelayMs: 20 });

    const { result } = renderHook(() => useDiaryWeek("2026-10-14"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.failureCount).toBe(1);
  });

  it("should retry a failed request, as the connection may come back", async () => {
    const dayLogs = { requests: 0 };
    server.use(
      http.get(`${REST_URL}/day_logs`, () => {
        dayLogs.requests += 1;
        return postgrestError(500, "XX000", "unavailable");
      }),
      answerTable("day_totals", []).handler,
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryWeek("2026-10-12"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(dayLogs.requests).toBe(4);
  });
});
