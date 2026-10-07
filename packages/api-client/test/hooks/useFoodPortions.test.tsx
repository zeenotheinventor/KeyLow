import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFoodPortions } from "../../src/hooks/useFoodPortions";
import { keys } from "../../src/queryKeys";
import { REST_URL, foodRow, portionRow, postgrestError, postgrestRows } from "../support/postgrest";
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

const FOOD_ID = foodRow().id;

describe("useFoodPortions", () => {
  it("should load the food's portions", async () => {
    server.use(
      http.get(`${REST_URL}/food_portions`, ({ request }) =>
        postgrestRows(request, [portionRow()]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFoodPortions(FOOD_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([portionRow()]);
  });

  it("should cache the portions under the portions key", async () => {
    server.use(
      http.get(`${REST_URL}/food_portions`, ({ request }) =>
        postgrestRows(request, [portionRow()]),
      ),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useFoodPortions(FOOD_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.foods.portions(FOOD_ID))).toEqual([portionRow()]);
  });

  it("should not fetch while the food id is not set", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/food_portions`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [portionRow()]);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFoodPortions(undefined), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });

  it("should expose the error when loading fails", async () => {
    server.use(
      http.get(`${REST_URL}/food_portions`, () =>
        postgrestError(500, "XX000", "database unavailable"),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFoodPortions(FOOD_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.message", "database unavailable");
  });
});
