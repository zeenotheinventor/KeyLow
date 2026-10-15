import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { keys } from "../../src/queryKeys";
import { dayLogRow, dayTotalsRow, foodEntryRow, quickEntryRow } from "../support/diary";
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

const answerDay = () => {
  const entries = answerTable("food_log_entries", [foodEntryRow(), quickEntryRow()]);
  const dayLogs = answerTable("day_logs", [dayLogRow()]);
  const dayTotals = answerTable("day_totals", [dayTotalsRow()]);
  server.use(entries.handler, dayLogs.handler, dayTotals.handler);
  return [entries.counter, dayLogs.counter, dayTotals.counter];
};

describe("useDiaryDay", () => {
  it("should load the day's entries, day log and totals", async () => {
    answerDay();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryDay("2026-10-15"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      localDate: "2026-10-15",
      entries: [foodEntryRow(), quickEntryRow()],
      dayLog: dayLogRow(),
      totals: dayTotalsRow(),
    });
  });

  it("should cache the day under the day key", async () => {
    answerDay();
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryDay("2026-10-15"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.diary.day("2026-10-15"))).toEqual(result.current.data);
  });

  it("should make no request while enabled is false", async () => {
    const counters = answerDay();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryDay("2026-10-15", { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counters.map((counter) => counter.requests)).toEqual([0, 0, 0]);
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("should load once enabled turns true", async () => {
    answerDay();
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ enabled }) => useDiaryDay("2026-10-15", { enabled }),
      { wrapper, initialProps: { enabled: false } },
    );
    expect(result.current.fetchStatus).toBe("idle");

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("should expose the error when loading fails", async () => {
    server.use(
      http.get(`${REST_URL}/food_log_entries`, () => postgrestError(500, "XX000", "unavailable")),
      answerTable("day_logs", []).handler,
      answerTable("day_totals", []).handler,
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDiaryDay("2026-10-15"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.message", "unavailable");
  });
});
