import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OffProductNotFoundError, RateLimitedError } from "../../src/errors";
import { useFoodSearch } from "../../src/hooks/useFoodSearch";
import { useMaterialiseOffProduct } from "../../src/hooks/useMaterialiseOffProduct";
import { keys } from "../../src/queryKeys";
import {
  GLOBAL_FOOD_ID,
  OFF_PRODUCT_URL,
  VALID_BARCODE,
  globalFoodRow,
  globalPortionRow,
  offProductResponse,
} from "../support/barcode";
import {
  OFF_SEARCH_URL,
  SEARCH_FOODS_URL,
  edgeErrorResponse,
  offCandidate,
  searchHitRows,
} from "../support/search";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

let searchFoodsCalls = 0;
let offSearchCalls = 0;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  searchFoodsCalls = 0;
  offSearchCalls = 0;
  server.use(
    http.post(SEARCH_FOODS_URL, () => {
      searchFoodsCalls += 1;
      return HttpResponse.json(searchHitRows(2));
    }),
    http.post(OFF_SEARCH_URL, () => {
      offSearchCalls += 1;
      return HttpResponse.json({ candidates: [offCandidate()] });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useMaterialiseOffProduct", () => {
  it("should post the candidate's code and resolve to the local food", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(OFF_PRODUCT_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(offProductResponse());
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMaterialiseOffProduct(), { wrapper });

    const food = await act(() => result.current.mutateAsync({ code: VALID_BARCODE }));

    expect(food).toEqual(globalFoodRow());
    expect(bodies).toEqual([{ code: VALID_BARCODE }]);
  });

  it("should seed the detail and portions caches of the food", async () => {
    server.use(http.post(OFF_PRODUCT_URL, () => HttpResponse.json(offProductResponse())));
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useMaterialiseOffProduct(), { wrapper });

    await act(() => result.current.mutateAsync({ code: VALID_BARCODE }));

    expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toEqual(globalFoodRow());
    expect(queryClient.getQueryData(keys.foods.portions(GLOBAL_FOOD_ID))).toEqual([
      globalPortionRow(),
    ]);
  });

  it("should throw an OffProductNotFoundError naming the code when Open Food Facts has no such product", async () => {
    server.use(
      http.post(OFF_PRODUCT_URL, () => edgeErrorResponse(404, "not_found", "No such product")),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useMaterialiseOffProduct(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync({ code: VALID_BARCODE }).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(OffProductNotFoundError);
    expect(failure).toHaveProperty("code", VALID_BARCODE);
    expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toBeUndefined();
  });

  it("should throw a RateLimitedError on a 429 and leave the caches alone", async () => {
    server.use(
      http.post(OFF_PRODUCT_URL, () => edgeErrorResponse(429, "rate_limited", "Slow down", 20)),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useMaterialiseOffProduct(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync({ code: VALID_BARCODE }).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RateLimitedError);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  describe("while a search is on screen", () => {
    it("should refresh the local search but not spend another Open Food Facts search", async () => {
      server.use(http.post(OFF_PRODUCT_URL, () => HttpResponse.json(offProductResponse())));
      const { wrapper } = createWrapper();
      const { result } = renderHook(
        () => ({ search: useFoodSearch("chicken"), materialise: useMaterialiseOffProduct() }),
        { wrapper },
      );
      await waitFor(() => {
        expect(result.current.search.off).toHaveLength(1);
      });
      expect(searchFoodsCalls).toBe(1);
      expect(offSearchCalls).toBe(1);

      await act(() => result.current.materialise.mutateAsync({ code: VALID_BARCODE }));

      await waitFor(() => {
        expect(searchFoodsCalls).toBe(2);
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
      expect(offSearchCalls).toBe(1);
      expect(result.current.search.off).toEqual([offCandidate()]);
    });
  });
});
