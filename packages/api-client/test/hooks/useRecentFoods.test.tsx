import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRecentFoods } from "../../src/hooks/useRecentFoods";
import { keys } from "../../src/queryKeys";
import { foodEntryRow } from "../support/diary";
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

const entry = foodEntryRow();
const answerRecent = () => {
  const entries = answerTable("food_log_entries", [
    {
      id: entry.id,
      food_id: entry.food_id,
      logged_at: entry.logged_at,
      portion_id: null,
      snapshot: entry.snapshot,
      foods: { deleted_at: null },
    },
  ]);
  server.use(entries.handler);
  return entries.counter;
};

describe("useRecentFoods", () => {
  it("should load the recent foods with their last snapshot", async () => {
    answerRecent();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecentFoods(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([
      {
        foodId: entry.food_id,
        entryId: entry.id,
        loggedAt: entry.logged_at,
        portionId: null,
        snapshot: entry.snapshot,
      },
    ]);
  });

  it("should cache the foods under the recent foods key", async () => {
    answerRecent();
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecentFoods(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.diary.recentFoods)).toEqual(result.current.data);
  });

  it("should make no request while enabled is false", async () => {
    const counter = answerRecent();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecentFoods({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counter.requests).toBe(0);
    expect(result.current.fetchStatus).toBe("idle");
  });
});
