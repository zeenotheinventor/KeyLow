import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useFoodPortions } from "../../src/hooks/useFoodPortions";
import { useRefreshOutdatedOffFood } from "../../src/hooks/useRefreshOutdatedOffFood";
import { invalidateFoodQueries } from "../../src/invalidateFoodQueries";
import { keys } from "../../src/queryKeys";
import {
  GLOBAL_FOOD_ID,
  OFF_PRODUCT_URL,
  VALID_BARCODE,
  globalFoodRow,
  globalPortionRow,
  offProductResponse,
} from "../support/barcode";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { edgeErrorResponse } from "../support/search";
import { createWrapper } from "../support/wrapper";

import type { Food } from "@keylow/core/schemas";

const server = setupServer();

const BEFORE_THE_RULES = "2026-10-20T10:00:00.000000+00:00";
const AFTER_THE_RULES = "2026-10-24T10:00:00.000000+00:00";
const OLD_PORTION_ID = "55555555-5555-4555-8555-555555555555";
const NEW_PORTION_ID = "66666666-6666-4666-8666-666666666666";

const oldFood = (overrides: Partial<Food> = {}) =>
  globalFoodRow({ fetched_at: BEFORE_THE_RULES, ...overrides });

const refreshedResponse = () =>
  offProductResponse({
    food: globalFoodRow({ fetched_at: AFTER_THE_RULES }),
    portions: [
      globalPortionRow({ id: NEW_PORTION_ID, label: "1 can", grams: 330 }),
      globalPortionRow({ id: "77777777-7777-4777-8777-777777777777", label: "1 tbsp" }),
    ],
  });

let offProductBodies: unknown[] = [];

const answerWithRefreshedProduct = () => {
  server.use(
    http.post(OFF_PRODUCT_URL, async ({ request }) => {
      offProductBodies.push(await request.json());
      return HttpResponse.json(refreshedResponse());
    }),
  );
};

/** Gives any request that was wrongly sent time to arrive, so a "nothing happens" test can trust its silence. */
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  offProductBodies = [];
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

describe("useRefreshOutdatedOffFood", () => {
  describe("a branded food fetched before the portion rules", () => {
    it("should ask off-product for its code once", async () => {
      answerWithRefreshedProduct();
      const { wrapper } = createWrapper();

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );

      await waitFor(() => {
        expect(offProductBodies).toEqual([{ code: VALID_BARCODE }]);
      });
    });

    it("should replace the cached food and portions with the refreshed ones", async () => {
      answerWithRefreshedProduct();
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.foods.detail(GLOBAL_FOOD_ID), oldFood());
      queryClient.setQueryData(keys.foods.portions(GLOBAL_FOOD_ID), [
        globalPortionRow({ id: OLD_PORTION_ID }),
      ]);

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );

      await waitFor(() => {
        expect(
          queryClient.getQueryData<{ id: string }[]>(keys.foods.portions(GLOBAL_FOOD_ID)),
        ).toEqual([
          expect.objectContaining({ id: NEW_PORTION_ID, label: "1 can" }),
          expect.objectContaining({ label: "1 tbsp" }),
        ]);
      });
      expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toEqual(
        globalFoodRow({ fetched_at: AFTER_THE_RULES }),
      );
    });

    it("should not let a read of the portions that started before the refresh put the old ones back", async () => {
      answerWithRefreshedProduct();
      server.use(
        http.get(`${REST_URL}/food_portions`, async ({ request }) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return postgrestRows(request, [globalPortionRow({ id: OLD_PORTION_ID })]);
        }),
      );
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
          return useFoodPortions(GLOBAL_FOOD_ID);
        },
        { wrapper },
      );
      await waitFor(() => {
        expect(result.current.data?.map(({ label }) => label)).toEqual(["1 can", "1 tbsp"]);
      });
      await flush();

      expect(result.current.data?.map(({ label }) => label)).toEqual(["1 can", "1 tbsp"]);
    });

    it("should not ask again when the same food is opened twice in a session", async () => {
      answerWithRefreshedProduct();
      const { wrapper } = createWrapper();
      const first = renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await waitFor(() => {
        expect(offProductBodies).toHaveLength(1);
      });
      first.unmount();

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await flush();

      expect(offProductBodies).toHaveLength(1);
    });

    it("should not ask again when the foods are invalidated while the screen is open", async () => {
      answerWithRefreshedProduct();
      const { queryClient, wrapper } = createWrapper();
      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await waitFor(() => {
        expect(offProductBodies).toHaveLength(1);
      });

      await act(() => invalidateFoodQueries(queryClient));
      await flush();

      expect(offProductBodies).toHaveLength(1);
    });

    it("should ask once for each of two foods", async () => {
      answerWithRefreshedProduct();
      const { wrapper } = createWrapper();
      const otherCode = "5449000000996";

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      renderHook(
        () => {
          useRefreshOutdatedOffFood(
            oldFood({ id: "88888888-8888-4888-8888-888888888888", source_ref: otherCode }),
          );
        },
        { wrapper },
      );

      await waitFor(() => {
        expect(offProductBodies).toHaveLength(2);
      });
      expect(offProductBodies).toEqual(
        expect.arrayContaining([{ code: VALID_BARCODE }, { code: otherCode }]),
      );
    });

    it("should ask when the connection returns, if the screen was opened offline", async () => {
      answerWithRefreshedProduct();
      onlineManager.setOnline(false);
      const { wrapper } = createWrapper();
      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await flush();
      expect(offProductBodies).toHaveLength(0);

      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(offProductBodies).toHaveLength(1);
      });
    });
  });

  describe("a food that needs no refresh", () => {
    it.each([
      ["fetched after the rules", oldFood({ fetched_at: AFTER_THE_RULES })],
      ["not from Open Food Facts", oldFood({ source: "cofid", source_ref: "13-123" })],
      ["without a source reference", oldFood({ source_ref: null })],
      ["without a fetch time", oldFood({ fetched_at: null })],
    ])("should not ask off-product for a food %s", async (_name, food) => {
      answerWithRefreshedProduct();
      const { wrapper } = createWrapper();

      renderHook(
        () => {
          useRefreshOutdatedOffFood(food);
        },
        { wrapper },
      );
      await flush();

      expect(offProductBodies).toHaveLength(0);
    });

    it("should not ask while there is no food yet", async () => {
      answerWithRefreshedProduct();
      const { wrapper } = createWrapper();

      renderHook(
        () => {
          useRefreshOutdatedOffFood(undefined);
        },
        { wrapper },
      );
      await flush();

      expect(offProductBodies).toHaveLength(0);
    });

    it("should not ask for a food that is not there", async () => {
      answerWithRefreshedProduct();
      const { wrapper } = createWrapper();

      renderHook(
        () => {
          useRefreshOutdatedOffFood(null);
        },
        { wrapper },
      );
      await flush();

      expect(offProductBodies).toHaveLength(0);
    });
  });

  describe("when the refresh fails", () => {
    it("should leave the cached portions as they were on a rate limit", async () => {
      server.use(
        http.post(OFF_PRODUCT_URL, () => edgeErrorResponse(429, "rate_limited", "Slow down", 20)),
      );
      const { queryClient, wrapper } = createWrapper();
      const oldPortions = [globalPortionRow({ id: OLD_PORTION_ID })];
      queryClient.setQueryData(keys.foods.portions(GLOBAL_FOOD_ID), oldPortions);

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await flush();

      expect(queryClient.getQueryData(keys.foods.portions(GLOBAL_FOOD_ID))).toEqual(oldPortions);
    });

    it("should leave the caches alone when the server answers with an error", async () => {
      server.use(http.post(OFF_PRODUCT_URL, () => HttpResponse.error()));
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.foods.detail(GLOBAL_FOOD_ID), oldFood());

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await flush();

      expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toEqual(oldFood());
    });

    it("should not ask again when the screen is opened again after a failure", async () => {
      let calls = 0;
      server.use(
        http.post(OFF_PRODUCT_URL, () => {
          calls += 1;
          return edgeErrorResponse(429, "rate_limited", "Slow down", 20);
        }),
      );
      const { wrapper } = createWrapper();
      const first = renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await waitFor(() => {
        expect(calls).toBe(1);
      });
      first.unmount();

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await flush();

      expect(calls).toBe(1);
    });

    it("should leave the caches alone when Open Food Facts no longer knows the product", async () => {
      server.use(
        http.post(OFF_PRODUCT_URL, () => edgeErrorResponse(404, "not_found", "No such product")),
      );
      const { queryClient, wrapper } = createWrapper();
      queryClient.setQueryData(keys.foods.detail(GLOBAL_FOOD_ID), oldFood());

      renderHook(
        () => {
          useRefreshOutdatedOffFood(oldFood());
        },
        { wrapper },
      );
      await flush();

      expect(queryClient.getQueryData(keys.foods.detail(GLOBAL_FOOD_ID))).toEqual(oldFood());
    });
  });
});
