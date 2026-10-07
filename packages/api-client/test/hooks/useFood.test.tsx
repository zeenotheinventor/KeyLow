import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFood } from "../../src/hooks/useFood";
import { keys } from "../../src/queryKeys";
import { REST_URL, foodRow, postgrestError, postgrestRows } from "../support/postgrest";
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

describe("useFood", () => {
  it("should load the food", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFood(foodRow().id), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(foodRow());
  });

  it("should resolve to null when the food is not visible to the user", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [])));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFood(foodRow().id), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("should cache the food under the detail key", async () => {
    server.use(http.get(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])));
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useFood(foodRow().id), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.foods.detail(foodRow().id))).toEqual(foodRow());
  });

  it("should not fetch while the id is not set", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [foodRow()]);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFood(undefined), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });

  it("should expose the error when loading fails", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFood(foodRow().id), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.message", "database unavailable");
  });
});
