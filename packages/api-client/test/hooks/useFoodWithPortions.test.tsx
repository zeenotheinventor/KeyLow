import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFoodWithPortions } from "../../src/hooks/useFoodWithPortions";
import { invalidateFoodQueries } from "../../src/invalidateFoodQueries";
import { REST_URL, foodRow, portionRow, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { QueryClient } from "@tanstack/react-query";

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

const FOOD_ID = foodRow().id;

const answerFood = (rows: unknown[]) => {
  server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, rows)));
};
const answerPortions = (rows: unknown[]) => {
  server.use(http.get(`${REST_URL}/food_portions`, ({ request }) => postgrestRows(request, rows)));
};
const failFood = () => {
  server.use(http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "food unavailable")));
};
const failPortions = () => {
  server.use(
    http.get(`${REST_URL}/food_portions`, () => postgrestError(500, "XX000", "portions down")),
  );
};

/** Refetches every foods query and lets the hook render what the refetch left behind. */
const refetchFoodQueries = (queryClient: QueryClient) =>
  act(async () => {
    await invalidateFoodQueries(queryClient);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

function renderFoodWithPortions() {
  const { queryClient, wrapper } = createWrapper();
  const rendered = renderHook(() => useFoodWithPortions(FOOD_ID), { wrapper });
  return { ...rendered, queryClient };
}

describe("useFoodWithPortions", () => {
  it("should be loading until both the food and its portions have arrived", async () => {
    answerFood([foodRow()]);
    answerPortions([portionRow()]);

    const { result } = renderFoodWithPortions();

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
  });

  it("should be ready with the food and its portions", async () => {
    answerFood([foodRow()]);
    answerPortions([portionRow()]);

    const { result } = renderFoodWithPortions();

    await waitFor(() => {
      expect(result.current).toEqual({
        status: "ready",
        food: foodRow(),
        portions: [portionRow()],
      });
    });
  });

  it("should be notFound when the food is not visible to the user", async () => {
    answerFood([]);
    answerPortions([]);

    const { result } = renderFoodWithPortions();

    await waitFor(() => {
      expect(result.current).toEqual({ status: "notFound" });
    });
  });

  it("should be an error when the food cannot be loaded, carrying only a debug message", async () => {
    failFood();
    answerPortions([portionRow()]);

    const { result } = renderFoodWithPortions();

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current).toEqual({
      status: "error",
      debugMessage: "Could not load the food: food unavailable",
    });
  });

  it("should be an error when the portions cannot be loaded", async () => {
    answerFood([foodRow()]);
    failPortions();

    const { result } = renderFoodWithPortions();

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current).toEqual({
      status: "error",
      debugMessage: "Could not load the food's portions: portions down",
    });
  });

  it("should stay ready when a refetch of the food fails", async () => {
    answerFood([foodRow()]);
    answerPortions([portionRow()]);
    const { result, queryClient } = renderFoodWithPortions();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    failFood();
    await refetchFoodQueries(queryClient);

    expect(queryClient.getQueryState(["foods", FOOD_ID])?.status).toBe("error");
    expect(result.current).toEqual({
      status: "ready",
      food: foodRow(),
      portions: [portionRow()],
    });
  });

  it("should stay ready when a refetch of the portions fails", async () => {
    answerFood([foodRow()]);
    answerPortions([portionRow()]);
    const { result, queryClient } = renderFoodWithPortions();
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    failPortions();
    await refetchFoodQueries(queryClient);

    expect(queryClient.getQueryState(["foods", FOOD_ID, "portions"])?.status).toBe("error");
    expect(result.current).toEqual({
      status: "ready",
      food: foodRow(),
      portions: [portionRow()],
    });
  });
});
