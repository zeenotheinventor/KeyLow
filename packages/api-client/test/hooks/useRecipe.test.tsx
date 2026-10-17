import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRecipe } from "../../src/hooks/useRecipe";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeDetailRow } from "../support/recipes";
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

describe("useRecipe", () => {
  it("should be loading, then ready with the recipe and its ingredients and steps", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [recipeDetailRow()])),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipe(RECIPE_ID), { wrapper });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      return;
    }
    expect(result.current.recipe.name).toBe("Chicken and rice");
    expect(result.current.recipe.ingredients).toHaveLength(3);
    expect(result.current.recipe.instructions).toEqual([
      "Poach the chicken.",
      "Cook the rice.",
      "Serve.",
    ]);
  });

  it("should cache the recipe under the detail key", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [recipeDetailRow()])),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipe(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toMatchObject({
      id: RECIPE_ID,
    });
  });

  it("should be not found, and not an error, for a recipe that is not visible", async () => {
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipe(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "notFound" });
    });
  });

  it("should make no request while enabled is false", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [recipeDetailRow()]);
      }),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipe(RECIPE_ID, { enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({ status: "loading" });
    expect(queryClient.isFetching()).toBe(0);
    expect(requests).toBe(0);
  });

  it.each([undefined, ""])("should make no request while the id is %j", async (id) => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [recipeDetailRow()]);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipe(id), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({ status: "loading" });
    expect(requests).toBe(0);
  });

  it("should be an error that names the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipe(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({
        status: "error",
        debugMessage: "Could not load the recipe (XX000)",
      });
    });
  });

  it("should stay ready with the recipe when a background refetch fails", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [recipeDetailRow()])),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useRecipe(RECIPE_ID), { wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    server.use(http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "unavailable")));
    await queryClient.refetchQueries({ queryKey: keys.recipes.detail(RECIPE_ID) });

    await waitFor(() => {
      expect(queryClient.getQueryState(keys.recipes.detail(RECIPE_ID))?.status).toBe("error");
    });
    expect(result.current.status).toBe("ready");
  });
});
