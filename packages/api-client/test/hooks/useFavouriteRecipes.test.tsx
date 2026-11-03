import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useFavouriteRecipes } from "../../src/hooks/useFavouriteRecipes";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { recipeSummaryRow } from "../support/recipes";
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

const recipe = recipeSummaryRow();

describe("useFavouriteRecipes", () => {
  it("should load the favourite recipes under keys.recipes.favourites", async () => {
    server.use(
      http.get(`${REST_URL}/recipe_favourites`, ({ request }) =>
        postgrestRows(request, [{ created_at: "2026-11-03T09:00:00+00:00", recipes: recipe }]),
      ),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useFavouriteRecipes(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([
      { recipeId: recipe.id, createdAt: "2026-11-03T09:00:00+00:00", recipe },
    ]);
    expect(queryClient.getQueryData(keys.recipes.favourites)).toEqual(result.current.data);
  });

  it("should be refreshed by the invalidation that archiving a recipe makes", async () => {
    let reads = 0;
    server.use(
      http.get(`${REST_URL}/recipe_favourites`, ({ request }) => {
        reads += 1;
        return postgrestRows(request, []);
      }),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useFavouriteRecipes(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await queryClient.invalidateQueries({ queryKey: keys.recipes.all });

    expect(reads).toBe(2);
  });

  it("should not read anything while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useFavouriteRecipes({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
