import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRecipes } from "../../src/hooks/useRecipes";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
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

const rows = [
  recipeSummaryRow({ name: "Chicken and rice" }),
  recipeSummaryRow({ id: "55555555-5555-4555-8555-555555555555", name: "Dal" }),
];

describe("useRecipes", () => {
  it("should load the library", async () => {
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, rows)));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipes(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.map((recipe) => recipe.name)).toEqual(["Chicken and rice", "Dal"]);
  });

  it("should cache the live library under the list key", async () => {
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, rows)));
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipes(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.recipes.list(false))).toEqual(result.current.data);
  });

  it("should ask for archived recipes as well, under their own key, when archived is true", async () => {
    let archivedFilter: string | null | undefined;
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        archivedFilter = new URL(request.url).searchParams.get("is_archived");
        return postgrestRows(request, rows);
      }),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipes({ archived: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(archivedFilter).toBeNull();
    expect(queryClient.getQueryData(keys.recipes.list(true))).toEqual(result.current.data);
    expect(queryClient.getQueryData(keys.recipes.list(false))).toBeUndefined();
  });

  it("should make no request while enabled is false", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, rows);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipes({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });

  it("should expose an error that names the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipes(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toEqual(new Error("Could not load your recipes (XX000)"));
    expect(result.current.error).toHaveProperty("cause", { code: "XX000" });
  });

  it("should keep the library on screen when a background refetch fails", async () => {
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, rows)));
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useRecipes(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const loaded = result.current.data;

    server.use(http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "unavailable")));
    await queryClient.refetchQueries({ queryKey: keys.recipes.list(false) });

    await waitFor(() => {
      expect(result.current.isRefetchError).toBe(true);
    });
    expect(result.current.data).toEqual(loaded);
    expect(result.current.data).toHaveLength(2);
  });
});
