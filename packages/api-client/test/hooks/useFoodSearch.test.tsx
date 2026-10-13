import { focusManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useFoodSearch } from "../../src/hooks/useFoodSearch";
import { postgrestError } from "../support/postgrest";
import {
  OFF_SEARCH_URL,
  SEARCH_FOODS_URL,
  edgeErrorResponse,
  offCandidate,
  searchHitRows,
} from "../support/search";
import { createWrapper } from "../support/wrapper";

import type { UseFoodSearchOptions } from "../../src/hooks/useFoodSearch";
import type { FoodSearchHit } from "../../src/repos/foods";
import type { OffCandidate } from "@keylow/core/schemas";

const server = setupServer();

type SearchFoodsBody = { q: string; lim: number };
type OffSearchBody = { q: string };

let searchFoodsBodies: SearchFoodsBody[] = [];
let offSearchBodies: OffSearchBody[] = [];

/** Answers the RPC with `rows(q)` and records what was asked. */
const answerRpc = (rows: (q: string) => FoodSearchHit[]) => {
  server.use(
    http.post<never, SearchFoodsBody>(SEARCH_FOODS_URL, async ({ request }) => {
      const body = await request.clone().json();
      searchFoodsBodies.push(body);
      return HttpResponse.json(rows(body.q));
    }),
  );
};

const answerOff = (candidates: (q: string) => OffCandidate[]) => {
  server.use(
    http.post<never, OffSearchBody>(OFF_SEARCH_URL, async ({ request }) => {
      const body = await request.clone().json();
      offSearchBodies.push(body);
      return HttpResponse.json({ candidates: candidates(body.q) });
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
  searchFoodsBodies = [];
  offSearchBodies = [];
});
afterAll(() => {
  server.close();
});

const DEBOUNCE_MS = 250;

const settleDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  });

function renderSearch(initialQuery: string, options?: UseFoodSearchOptions) {
  const { queryClient, wrapper } = createWrapper();
  const rendered = renderHook(({ query }) => useFoodSearch(query, options), {
    wrapper,
    initialProps: { query: initialQuery },
  });

  const search = async (query: string) => {
    rendered.rerender({ query });
    await settleDebounce();
  };

  return { ...rendered, queryClient, search };
}

describe("useFoodSearch", () => {
  describe("the local search", () => {
    it("should make exactly one RPC call for five keystrokes within the debounce window", async () => {
      answerRpc(() => searchHitRows(5));
      const { result, rerender } = renderSearch("c");

      for (const query of ["ch", "chi", "chic", "chick"]) {
        rerender({ query });
      }
      expect(searchFoodsBodies).toEqual([]);

      await settleDebounce();
      await waitFor(() => {
        expect(result.current.local).toHaveLength(5);
      });

      expect(searchFoodsBodies).toEqual([{ q: "chick", lim: 25 }]);
    });

    it("should not search for fewer than 2 characters", async () => {
      answerRpc(() => searchHitRows(5));
      const { result, search } = renderSearch("c");

      await search("  c ");
      await vi.advanceTimersByTimeAsync(500);

      expect(searchFoodsBodies).toEqual([]);
      expect(result.current).toEqual({
        local: [],
        off: [],
        isLoadingLocal: false,
        isLoadingOff: false,
        isDebouncing: false,
        offError: null,
        localError: null,
      });
    });

    it("should search the trimmed query", async () => {
      answerRpc(() => searchHitRows(5));
      const { result } = renderSearch("  chicken  ");

      await settleDebounce();
      await waitFor(() => {
        expect(result.current.local).toHaveLength(5);
      });

      expect(searchFoodsBodies).toEqual([{ q: "chicken", lim: 25 }]);
    });

    it("should pass the limit option to the RPC", async () => {
      answerRpc(() => searchHitRows(5));
      const { result } = renderSearch("chicken", { limit: 10 });

      await waitFor(() => {
        expect(result.current.local).toHaveLength(5);
      });

      expect(searchFoodsBodies).toEqual([{ q: "chicken", lim: 10 }]);
    });

    it("should make no call at all when disabled", async () => {
      answerRpc(() => searchHitRows(5));
      const { result } = renderSearch("chicken", { enabled: false });

      await settleDebounce();
      await vi.advanceTimersByTimeAsync(500);

      expect(searchFoodsBodies).toEqual([]);
      expect(result.current.local).toEqual([]);
    });

    it("should keep the previous results in view while the next query loads", async () => {
      const first = searchHitRows(3);
      const second = searchHitRows(2).map((hit) => ({ ...hit, name: `Chickpea ${hit.name}` }));
      let releaseSecond: () => void = () => undefined;
      const secondMayAnswer = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      server.use(
        http.post<never, SearchFoodsBody>(SEARCH_FOODS_URL, async ({ request }) => {
          const { q } = await request.clone().json();
          if (q === "chicken") {
            await secondMayAnswer;
            return HttpResponse.json(second);
          }
          return HttpResponse.json(first);
        }),
      );
      server.use(http.post(OFF_SEARCH_URL, () => HttpResponse.json({ candidates: [] })));
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.local).toEqual(first);
      });
      expect(result.current.isLoadingLocal).toBe(false);

      await search("chicken");

      await waitFor(() => {
        expect(result.current.isLoadingLocal).toBe(true);
      });
      expect(result.current.local).toEqual(first);

      releaseSecond();
      await waitFor(() => {
        expect(result.current.local).toEqual(second);
      });
      expect(result.current.isLoadingLocal).toBe(false);
    });

    it("should empty the list when the query drops below 2 characters", async () => {
      answerRpc(() => searchHitRows(5));
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.local).toHaveLength(5);
      });

      await search("c");

      expect(result.current.local).toEqual([]);
      expect(result.current.isLoadingLocal).toBe(false);
    });
  });

  describe("the debounce signal", () => {
    it("should be false on the first render, since the first query is searched at once", () => {
      answerRpc(() => searchHitRows(5));
      const { result } = renderSearch("chicken");

      expect(result.current.isDebouncing).toBe(false);
    });

    it("should be true for the whole gap after a keystroke and false once the gap has passed", async () => {
      answerRpc(() => searchHitRows(5));
      const { result, rerender } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.local).toHaveLength(5);
      });

      rerender({ query: "chicke" });
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
      const hits = searchHitRows(5);
      answerRpc(() => hits);
      const { result, rerender } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.local).toEqual(hits);
      });

      rerender({ query: "chicke" });

      expect(result.current.isDebouncing).toBe(true);
      expect(result.current.local).toEqual(hits);
    });

    it("should be true while a query too short to search waits to be searched", async () => {
      answerRpc(() => searchHitRows(5));
      const { result, rerender } = renderSearch("");

      rerender({ query: "ch" });

      expect(result.current.isDebouncing).toBe(true);
      expect(result.current.local).toEqual([]);
      expect(result.current.isLoadingLocal).toBe(false);

      await settleDebounce();
      expect(result.current.isDebouncing).toBe(false);
    });

    it("should stay false when only the whitespace around the query changes", () => {
      answerRpc(() => searchHitRows(5));
      const { result, rerender } = renderSearch("chicken");

      rerender({ query: " chicken " });

      expect(result.current.isDebouncing).toBe(false);
    });

    it("should stay false when disabled, since nothing will be searched", () => {
      const { result, rerender } = renderSearch("chick", { enabled: false });

      rerender({ query: "chicken" });

      expect(result.current.isDebouncing).toBe(false);
    });

    it("should be true for a single tick with debounceMs 0, and false after it", async () => {
      answerRpc(() => searchHitRows(5));
      const { result, rerender } = renderSearch("chick", { debounceMs: 0 });

      rerender({ query: "chicken" });
      expect(result.current.isDebouncing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.isDebouncing).toBe(false);
    });

    it("should not search before the default 250 ms have passed", async () => {
      answerRpc(() => searchHitRows(5));
      const { rerender } = renderSearch("chick");
      await vi.advanceTimersByTimeAsync(0);
      searchFoodsBodies = [];

      rerender({ query: "chicken" });
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      expect(searchFoodsBodies).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      await waitFor(() => {
        expect(searchFoodsBodies).toEqual([{ q: "chicken", lim: 25 }]);
      });
    });
  });

  describe("the Open Food Facts fallback", () => {
    it("should make no off-search call when the local search has 5 hits", async () => {
      answerRpc(() => searchHitRows(5));
      answerOff(() => [offCandidate()]);
      const { result } = renderSearch("chicken");

      await waitFor(() => {
        expect(result.current.local).toHaveLength(5);
      });
      await vi.advanceTimersByTimeAsync(500);

      expect(offSearchBodies).toEqual([]);
      expect(result.current.off).toEqual([]);
      expect(result.current.isLoadingOff).toBe(false);
    });

    it("should make exactly one off-search call when the local search has 4 hits", async () => {
      answerRpc(() => searchHitRows(4));
      answerOff(() => [offCandidate()]);
      const { result } = renderSearch("chicken");

      await waitFor(() => {
        expect(result.current.off).toEqual([offCandidate()]);
      });

      expect(offSearchBodies).toEqual([{ q: "chicken" }]);
      expect(result.current.local).toHaveLength(4);
      expect(result.current.isLoadingOff).toBe(false);
      expect(result.current.offError).toBeNull();
    });

    it("should search Open Food Facts when the local search has no hits", async () => {
      answerRpc(() => []);
      answerOff(() => [offCandidate()]);
      const { result } = renderSearch("quinoa");

      await waitFor(() => {
        expect(result.current.off).toEqual([offCandidate()]);
      });
    });

    it("should honour the offThreshold option", async () => {
      answerRpc(() => searchHitRows(2));
      answerOff(() => [offCandidate()]);
      const { result } = renderSearch("chicken", { offThreshold: 2 });

      await waitFor(() => {
        expect(result.current.local).toHaveLength(2);
      });
      await vi.advanceTimersByTimeAsync(500);

      expect(offSearchBodies).toEqual([]);
    });

    it("should not call off-search again for the same query within 10 minutes", async () => {
      answerRpc(() => searchHitRows(2));
      answerOff(() => [offCandidate()]);
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.off).toHaveLength(1);
      });

      await search("chicken");
      await waitFor(() => {
        expect(offSearchBodies.map(({ q }) => q)).toEqual(["chick", "chicken"]);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
      });
      await search("chick");
      await waitFor(() => {
        expect(result.current.isLoadingOff).toBe(false);
      });

      expect(offSearchBodies.map(({ q }) => q)).toEqual(["chick", "chicken"]);
      expect(result.current.off).toEqual([offCandidate()]);
    });

    it("should call off-search again once 10 minutes have passed", async () => {
      answerRpc(() => searchHitRows(2));
      answerOff(() => [offCandidate()]);
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.off).toHaveLength(1);
      });

      await search("chicken");
      await waitFor(() => {
        expect(offSearchBodies).toHaveLength(2);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
      });
      await search("chick");

      await waitFor(() => {
        expect(offSearchBodies.map(({ q }) => q)).toEqual(["chick", "chicken", "chick"]);
      });
    });

    it("should keep the previous candidates in view and wait for the next local search before asking Open Food Facts", async () => {
      let releaseSecond: () => void = () => undefined;
      const secondMayAnswer = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      server.use(
        http.post<never, SearchFoodsBody>(SEARCH_FOODS_URL, async ({ request }) => {
          const { q } = await request.clone().json();
          if (q === "chicken") {
            await secondMayAnswer;
            return HttpResponse.json(searchHitRows(6));
          }
          return HttpResponse.json(searchHitRows(2));
        }),
      );
      answerOff(() => [offCandidate()]);
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.off).toEqual([offCandidate()]);
      });

      await search("chicken");
      await waitFor(() => {
        expect(result.current.isLoadingLocal).toBe(true);
      });

      expect(result.current.off).toEqual([offCandidate()]);
      expect(result.current.isLoadingOff).toBe(true);
      expect(offSearchBodies).toEqual([{ q: "chick" }]);

      releaseSecond();
      await waitFor(() => {
        expect(result.current.local).toHaveLength(6);
      });
      await vi.advanceTimersByTimeAsync(500);

      expect(offSearchBodies).toEqual([{ q: "chick" }]);
    });

    it("should not bring back candidates from two queries ago when the next query loads", async () => {
      const candidateOfChick = offCandidate({ code: "5000000000017", name: "Chick soup" });
      const candidateOfTuna = offCandidate({ code: "5000000000024", name: "Tuna steak" });
      let releaseTuna: () => void = () => undefined;
      const tunaMayAnswer = new Promise<void>((resolve) => {
        releaseTuna = resolve;
      });
      server.use(
        http.post<never, SearchFoodsBody>(SEARCH_FOODS_URL, async ({ request }) => {
          const { q } = await request.clone().json();
          return HttpResponse.json(searchHitRows(q === "chocolate" ? 6 : 2));
        }),
        http.post<never, OffSearchBody>(OFF_SEARCH_URL, async ({ request }) => {
          const { q } = await request.clone().json();
          offSearchBodies.push({ q });
          if (q === "tuna") {
            await tunaMayAnswer;
            return HttpResponse.json({ candidates: [candidateOfTuna] });
          }
          return HttpResponse.json({ candidates: [candidateOfChick] });
        }),
      );
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.off).toEqual([candidateOfChick]);
      });

      await search("chocolate");
      await waitFor(() => {
        expect(result.current.local).toHaveLength(6);
      });
      expect(result.current.off).toEqual([]);

      await search("tuna");
      await waitFor(() => {
        expect(offSearchBodies.map(({ q }) => q)).toEqual(["chick", "tuna"]);
      });

      expect(result.current.isLoadingOff).toBe(true);
      expect(result.current.off).toEqual([]);

      releaseTuna();
      await waitFor(() => {
        expect(result.current.off).toEqual([candidateOfTuna]);
      });
    });

    it("should hide the candidates of the previous query once the new query has enough local hits", async () => {
      server.use(
        http.post<never, SearchFoodsBody>(SEARCH_FOODS_URL, async ({ request }) => {
          const { q } = await request.clone().json();
          return HttpResponse.json(searchHitRows(q === "chick" ? 2 : 6));
        }),
      );
      answerOff(() => [offCandidate()]);
      const { result, search } = renderSearch("chick");
      await waitFor(() => {
        expect(result.current.off).toHaveLength(1);
      });

      await search("chicken");

      await waitFor(() => {
        expect(result.current.local).toHaveLength(6);
      });
      expect(result.current.off).toEqual([]);
      expect(result.current.isLoadingOff).toBe(false);
    });

    describe("when Open Food Facts refuses or fails", () => {
      it("should report a rate limit with its delay and keep the local results", async () => {
        const hits = searchHitRows(2);
        answerRpc(() => hits);
        server.use(
          http.post<never, OffSearchBody>(OFF_SEARCH_URL, async ({ request }) => {
            offSearchBodies.push(await request.clone().json());
            return edgeErrorResponse(429, "rate_limited", "Slow down", 20);
          }),
        );
        const { result, queryClient } = renderSearch("chicken");
        // A client that retries by default must still not retry a rate limit.
        queryClient.setDefaultOptions({ queries: { retry: 3, retryDelay: 1 } });

        await waitFor(() => {
          expect(result.current.offError).toEqual({
            kind: "rate_limited",
            retryAfterSeconds: 20,
            debugMessage: "Slow down",
            message: "Slow down",
          });
        });
        await vi.advanceTimersByTimeAsync(500);

        expect(result.current.local).toEqual(hits);
        expect(result.current.off).toEqual([]);
        expect(result.current.isLoadingOff).toBe(false);
        expect(offSearchBodies).toHaveLength(1);
      });

      it("should not search again when the window regains focus after a rate limit", async () => {
        answerRpc(() => searchHitRows(2));
        server.use(
          http.post<never, OffSearchBody>(OFF_SEARCH_URL, async ({ request }) => {
            offSearchBodies.push(await request.clone().json());
            return edgeErrorResponse(429, "rate_limited", "Slow down", 20);
          }),
        );
        const { result } = renderSearch("chicken");
        await waitFor(() => {
          expect(result.current.offError).toMatchObject({ kind: "rate_limited" });
        });

        act(() => {
          focusManager.setFocused(false);
          focusManager.setFocused(true);
        });
        await vi.advanceTimersByTimeAsync(500);
        focusManager.setFocused(undefined);

        expect(offSearchBodies).toHaveLength(1);
        expect(searchFoodsBodies).toHaveLength(1);
      });

      it("should report a rate limit that carries no delay without a retryAfterSeconds key", async () => {
        answerRpc(() => searchHitRows(2));
        server.use(
          http.post(OFF_SEARCH_URL, () => HttpResponse.text("Too Many Requests", { status: 429 })),
        );
        const { result } = renderSearch("chicken");

        await waitFor(() => {
          expect(result.current.offError).toEqual({
            kind: "rate_limited",
            debugMessage: 'Edge function "off-search" was rate limited',
            message: 'Edge function "off-search" was rate limited',
          });
        });
      });

      it.each([
        [404, "not_found"],
        [502, "upstream_error"],
        [400, "invalid_request"],
        [401, "unauthorized"],
        [500, "internal_error"],
      ] as const)(
        "should report an edge answer of %i as the kind %s, keeping the raw text only as debugMessage",
        async (status, code) => {
          const hits = searchHitRows(2);
          answerRpc(() => hits);
          server.use(
            http.post(OFF_SEARCH_URL, () => edgeErrorResponse(status, code, "Raw upstream text")),
          );
          const { result } = renderSearch("chicken");

          await waitFor(() => {
            expect(result.current.offError).toEqual({
              kind: code,
              debugMessage: "Raw upstream text",
              message: "Raw upstream text",
            });
          });
          expect(result.current.local).toEqual(hits);
        },
      );

      it("should report a server error as failed", async () => {
        answerRpc(() => searchHitRows(2));
        server.use(http.post(OFF_SEARCH_URL, () => HttpResponse.text("oops", { status: 500 })));
        const { result } = renderSearch("chicken");

        await waitFor(() => {
          expect(result.current.offError).toEqual({
            kind: "failed",
            debugMessage: 'Edge function "off-search" failed',
            message: 'Edge function "off-search" failed',
          });
        });
      });
    });
  });

  describe("when the local search fails", () => {
    it("should report a local error, return no results and never reach Open Food Facts", async () => {
      server.use(
        http.post(SEARCH_FOODS_URL, () => postgrestError(500, "XX000", "database unavailable")),
      );
      answerOff(() => [offCandidate()]);
      const { result } = renderSearch("chicken");

      await waitFor(() => {
        expect(result.current.localError).not.toBeNull();
      });
      await vi.advanceTimersByTimeAsync(500);

      expect(result.current.localError).toMatchObject({ kind: "failed" });
      expect(result.current.localError?.debugMessage).toContain("database unavailable");
      expect(result.current.localError?.message).toContain("database unavailable");
      expect(result.current.local).toEqual([]);
      expect(result.current.off).toEqual([]);
      expect(result.current.isLoadingLocal).toBe(false);
      expect(result.current.isLoadingOff).toBe(false);
      expect(result.current.offError).toBeNull();
      expect(offSearchBodies).toEqual([]);
    });

    it("should have no local error when the search succeeds, even with no matches", async () => {
      answerRpc(() => []);
      answerOff(() => []);
      const { result } = renderSearch("quinoa");

      await waitFor(() => {
        expect(offSearchBodies).toHaveLength(1);
      });

      expect(result.current.localError).toBeNull();
    });
  });
});
