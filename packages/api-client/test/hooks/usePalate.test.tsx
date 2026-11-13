import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { usePalateLoggedDays } from "../../src/hooks/usePalateLoggedDays";
import { usePalatePreferences } from "../../src/hooks/usePalatePreferences";
import { usePalateStats } from "../../src/hooks/usePalateStats";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { databaseErrorQuotingTheRow, expectNoQuotedText } from "../support/quotedDatabaseError";
import { createWrapper } from "../support/wrapper";

const FOOD_ID = "55555555-5555-4555-8555-555555555555";

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

describe("usePalatePreferences", () => {
  it("should load the person's preferences", async () => {
    server.use(
      http.get(`${REST_URL}/palate_preferences`, ({ request }) =>
        postgrestRows(request, [
          {
            id: "44444444-4444-4444-8444-444444444444",
            kind: "allergy",
            food_id: null,
            recipe_id: null,
            label: "stub word",
            created_at: "2026-11-13T10:00:00+00:00",
          },
        ]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalatePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.kind).toBe("allergy");
  });

  it("should make no request while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalatePreferences({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should surface an error that names the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/palate_preferences`, () => databaseErrorQuotingTheRow("42501")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalatePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your palate preferences (42501)");
    expectNoQuotedText(result.current.error ?? new Error("no error"));
  });
});

describe("usePalateStats", () => {
  it("should load what the person eats most", async () => {
    server.use(
      http.get(`${REST_URL}/palate_food_stats`, ({ request }) =>
        postgrestRows(request, [
          {
            food_id: FOOD_ID,
            recipe_id: null,
            entry_count: 5,
            distinct_days: 3,
            first_local_date: "2026-08-16",
            last_local_date: "2026-11-13",
            median_resolved_grams: 300,
            before_eleven_count: 2,
            eleven_to_sixteen_count: 2,
            sixteen_or_later_count: 1,
          },
        ]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalateStats(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.[0]?.entryCount).toBe(5);
    expect(result.current.data?.[0]?.foodId).toBe(FOOD_ID);
  });

  it("should make no request while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalateStats({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should surface an error that names the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/palate_food_stats`, () => databaseErrorQuotingTheRow("42501")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalateStats(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load what you eat most (42501)");
  });
});

describe("usePalateLoggedDays", () => {
  it("should load the count of logged days", async () => {
    server.use(
      http.get(`${REST_URL}/palate_logged_days`, ({ request }) =>
        postgrestRows(request, [{ logged_days: 12 }]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalateLoggedDays(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(12);
  });

  it("should make no request while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePalateLoggedDays({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
