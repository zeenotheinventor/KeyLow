import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useCompleteDays } from "../../src/hooks/useCompleteDays";
import { keys } from "../../src/queryKeys";
import { dayLogRow } from "../support/diary";
import { answerTable } from "../support/diaryServer";
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

const answerMonth = () => {
  const dayLogs = answerTable("day_logs", [
    dayLogRow({ local_date: "2026-10-03" }),
    dayLogRow({ local_date: "2026-10-20" }),
  ]);
  server.use(dayLogs.handler);
  return dayLogs.counter;
};

describe("useCompleteDays", () => {
  it("should load the complete dates of the month", async () => {
    answerMonth();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCompleteDays("2026-10"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(["2026-10-03", "2026-10-20"]);
  });

  it("should cache the dates under the month key", async () => {
    answerMonth();
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useCompleteDays("2026-10"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.diary.completeDays("2026-10"))).toEqual(
      result.current.data,
    );
  });

  it("should make no request while enabled is false", async () => {
    const counter = answerMonth();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCompleteDays("2026-10", { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counter.requests).toBe(0);
    expect(result.current.fetchStatus).toBe("idle");
  });
});
