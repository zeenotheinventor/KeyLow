import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFavouriteFoods } from "../../src/hooks/useFavouriteFoods";
import { keys } from "../../src/queryKeys";
import { REST_URL, foodRow, postgrestRows } from "../support/postgrest";
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

const food = foodRow();

describe("useFavouriteFoods", () => {
  it("should load the favourite foods under keys.foods.favourites", async () => {
    server.use(
      http.get(`${REST_URL}/food_favourites`, ({ request }) =>
        postgrestRows(request, [{ created_at: "2026-11-03T09:00:00+00:00", foods: food }]),
      ),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useFavouriteFoods(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([
      { foodId: food.id, createdAt: "2026-11-03T09:00:00+00:00", food },
    ]);
    expect(queryClient.getQueryData(keys.foods.favourites)).toEqual(result.current.data);
  });

  it("should not read anything while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFavouriteFoods({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
