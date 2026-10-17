import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useRecipeSearch } from "../../src/hooks/useRecipeSearch";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError } from "../support/postgrest";
import { recipeSummaryRow } from "../support/recipes";
import { createWrapper } from "../support/wrapper";

import type { UseRecipeSearchOptions } from "../../src/hooks/useRecipeSearch";

const server = setupServer();

type SearchRequest = { name: string | null; archived: string | null; limit: string | null };

let requests: SearchRequest[] = [];

/** Answers every recipes read with `rows(name)`, where `name` is the `ilike` filter, and records the request. */
const answerSearch = (rows: (name: string | null) => unknown[]) => {
  server.use(
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const seen = {
        name: searchParams.get("name"),
        archived: searchParams.get("is_archived"),
        limit: searchParams.get("limit"),
      };
      requests.push(seen);
      return HttpResponse.json(rows(seen.name));
    }),
  );
};

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  // Real time still passes, so waitFor and the network keep working. The debounce is advanced explicitly.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  requests = [];
});
afterAll(() => {
  server.close();
});

const DEBOUNCE_MS = 250;

// shouldAdvanceTime lets real time seep into the fake clock, so a check at DEBOUNCE_MS - 1 could be
// carried past the boundary. A test that asserts the state inside the gap calls this once its network
// waits are over, so only the test moves the clock.
const stopRealTimeAdvancingTheClock = () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
};

const settleDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  });

function renderSearch(initialQuery: string, options?: UseRecipeSearchOptions) {
  const { queryClient, wrapper } = createWrapper();
  const rendered = renderHook(({ query }) => useRecipeSearch(query, options), {
    wrapper,
    initialProps: { query: initialQuery },
  });

  const search = async (query: string) => {
    rendered.rerender({ query });
    await settleDebounce();
  };

  return { ...rendered, queryClient, search };
}

const stews = [
  recipeSummaryRow({ name: "Beef stew" }),
  recipeSummaryRow({ id: "55555555-5555-4555-8555-555555555555", name: "Lamb stew" }),
];

describe("useRecipeSearch", () => {
  it("should be loading, then give the matching recipes", async () => {
    answerSearch(() => stews);

    const { result } = renderSearch("stew");

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.recipes.map((recipe) => recipe.name)).toEqual([
        "Beef stew",
        "Lamb stew",
      ]);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should cache the result under the search key", async () => {
    answerSearch(() => stews);

    const { result, queryClient } = renderSearch("stew");

    await waitFor(() => {
      expect(result.current.recipes).toHaveLength(2);
    });
    expect(queryClient.getQueryData(keys.recipes.search("stew"))).toEqual(result.current.recipes);
  });

  it("should make exactly one request for five keystrokes within the debounce window", async () => {
    answerSearch(() => stews);
    const { result, rerender } = renderSearch("s");

    for (const query of ["st", "ste", "stew", "stews"]) {
      rerender({ query });
    }
    expect(requests).toEqual([]);

    await settleDebounce();
    await waitFor(() => {
      expect(result.current.recipes).toHaveLength(2);
    });

    expect(requests).toEqual([{ name: "ilike.%stews%", archived: "eq.false", limit: "25" }]);
  });

  it("should not search for fewer than 2 characters", async () => {
    answerSearch(() => stews);
    const { result, search } = renderSearch("s");

    await search("  s ");
    await vi.advanceTimersByTimeAsync(500);

    expect(requests).toEqual([]);
    expect(result.current).toEqual({
      recipes: [],
      isLoading: false,
      isDebouncing: false,
      error: null,
    });
  });

  it("should search the trimmed query", async () => {
    answerSearch(() => stews);
    const { result } = renderSearch("  stew  ");

    await waitFor(() => {
      expect(result.current.recipes).toHaveLength(2);
    });

    expect(requests.map((request) => request.name)).toEqual(["ilike.%stew%"]);
  });

  it("should pass archived and limit to the search", async () => {
    answerSearch(() => stews);
    const { result, queryClient } = renderSearch("stew", { archived: true, limit: 10 });

    await waitFor(() => {
      expect(result.current.recipes).toHaveLength(2);
    });

    expect(requests).toEqual([{ name: "ilike.%stew%", archived: null, limit: "10" }]);
    expect(queryClient.getQueryData(keys.recipes.search("stew", true))).toHaveLength(2);
  });

  it("should make no request while enabled is false", async () => {
    answerSearch(() => stews);
    const { result } = renderSearch("stew", { enabled: false });

    await settleDebounce();
    await vi.advanceTimersByTimeAsync(500);

    expect(requests).toEqual([]);
    expect(result.current.recipes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("should give no recipes, and not an error, for a word that matches nothing", async () => {
    answerSearch(() => []);
    const { result } = renderSearch("stew");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recipes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("should keep the previous results in view while the next query loads", async () => {
    const next = [recipeSummaryRow({ name: "Stewed plums" })];
    let releaseNext: () => void = () => undefined;
    const nextMayAnswer = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    server.use(
      http.get(`${REST_URL}/recipes`, async ({ request }) => {
        if (new URL(request.url).searchParams.get("name") === "ilike.%stewed%") {
          await nextMayAnswer;
          return HttpResponse.json(next);
        }
        return HttpResponse.json(stews);
      }),
    );
    const { result, search } = renderSearch("stew");
    await waitFor(() => {
      expect(result.current.recipes).toHaveLength(2);
    });
    expect(result.current.isLoading).toBe(false);

    await search("stewed");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(result.current.recipes).toHaveLength(2);

    releaseNext();
    await waitFor(() => {
      expect(result.current.recipes.map((recipe) => recipe.name)).toEqual(["Stewed plums"]);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("should empty the list when the query drops below 2 characters", async () => {
    answerSearch(() => stews);
    const { result, search } = renderSearch("stew");
    await waitFor(() => {
      expect(result.current.recipes).toHaveLength(2);
    });

    await search("s");

    expect(result.current.recipes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  describe("the debounce signal", () => {
    it("should be false on the first render, since the first query is searched at once", () => {
      answerSearch(() => stews);
      const { result } = renderSearch("stew");

      expect(result.current.isDebouncing).toBe(false);
    });

    it("should be true for the whole gap after a keystroke and false once the gap has passed", async () => {
      answerSearch(() => stews);
      const { result, rerender } = renderSearch("stew");
      await waitFor(() => {
        expect(result.current.recipes).toHaveLength(2);
      });

      stopRealTimeAdvancingTheClock();
      rerender({ query: "stews" });
      expect(result.current.isDebouncing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      });
      expect(result.current.isDebouncing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(result.current.isDebouncing).toBe(false);
    });

    it("should keep the previous results in view while it is true", async () => {
      answerSearch(() => stews);
      const { result, rerender } = renderSearch("stew");
      await waitFor(() => {
        expect(result.current.recipes).toHaveLength(2);
      });

      rerender({ query: "stews" });

      expect(result.current.isDebouncing).toBe(true);
      expect(result.current.recipes).toHaveLength(2);
    });

    it("should be true while a query too short to search waits to be searched", async () => {
      answerSearch(() => stews);
      const { result, rerender } = renderSearch("");

      rerender({ query: "st" });

      expect(result.current.isDebouncing).toBe(true);
      expect(result.current.recipes).toEqual([]);
      expect(result.current.isLoading).toBe(false);

      await settleDebounce();
      expect(result.current.isDebouncing).toBe(false);
    });

    it("should stay false when only the whitespace around the query changes", () => {
      answerSearch(() => stews);
      const { result, rerender } = renderSearch("stew");

      rerender({ query: " stew " });

      expect(result.current.isDebouncing).toBe(false);
    });

    it("should stay false when disabled, since nothing will be searched", () => {
      const { result, rerender } = renderSearch("ste", { enabled: false });

      rerender({ query: "stew" });

      expect(result.current.isDebouncing).toBe(false);
    });

    it("should be true for a single tick with debounceMs 0, and false after it", async () => {
      answerSearch(() => stews);
      const { result, rerender } = renderSearch("ste", { debounceMs: 0 });

      rerender({ query: "stew" });
      expect(result.current.isDebouncing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.isDebouncing).toBe(false);
    });
  });

  describe("when the search fails", () => {
    it("should give an error that names the action and the code only, and no recipes", async () => {
      server.use(
        http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "database unavailable")),
      );
      const { result } = renderSearch("stew");

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toEqual({
        kind: "failed",
        debugMessage: "Could not search your recipes (XX000)",
      });
      expect(result.current.recipes).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should keep the results on screen when a background refetch fails", async () => {
      answerSearch(() => stews);
      const { result, queryClient } = renderSearch("stew");
      await waitFor(() => {
        expect(result.current.recipes).toHaveLength(2);
      });

      server.use(
        http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "unavailable")),
      );
      await queryClient.refetchQueries({ queryKey: keys.recipes.search("stew") });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
      expect(result.current.recipes).toHaveLength(2);
    });
  });
});
