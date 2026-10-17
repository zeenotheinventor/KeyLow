import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRecipeRefreshPreview } from "../../src/hooks/useRecipeRefreshPreview";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { answerRefreshReads, chicken, oil, rice } from "../support/recipeRefresh";
import { RECIPE_ID } from "../support/recipes";
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

const richerChicken = { ...chicken, kcal: 140 };

describe("useRecipeRefreshPreview", () => {
  it("should be loading, then ready with the diff and whether anything changed", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      return;
    }
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.diff.changes.map(({ changed }) => changed)).toEqual([true, false, false]);
  });

  it("should say nothing changed when every food is as the recipe froze it", async () => {
    answerRefreshReads(server, { foods: [chicken, rice, oil] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current).toMatchObject({ status: "ready", hasChanges: false });
  });

  it("should cache the diff under the refresh key, inside the recipes family", async () => {
    answerRefreshReads(server, { foods: [chicken, rice, oil] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(queryClient.getQueryData(keys.recipes.refresh(RECIPE_ID))).toMatchObject({
      hasChanges: false,
    });
  });

  it("should be not found, and not an error, for a recipe that is not visible", async () => {
    answerRefreshReads(server, { foods: [chicken, rice, oil] });
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "notFound" });
    });
  });

  it("should make no request while enabled is false", async () => {
    const reads = answerRefreshReads(server, { foods: [chicken, rice, oil] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID, { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({ status: "loading" });
    expect(queryClient.isFetching()).toBe(0);
    expect([reads.recipes, reads.foodIds, reads.portionFoodIds]).toEqual([0, [], []]);
  });

  it.each([undefined, ""])("should make no request while the id is %j", async (id) => {
    const reads = answerRefreshReads(server, { foods: [chicken, rice, oil] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(id), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({ status: "loading" });
    expect(reads.recipes).toBe(0);
  });

  it("should fail the whole preview, with no partial diff, when one food read fails", async () => {
    answerRefreshReads(server, { foods: [chicken, rice, oil] });
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) =>
        new URL(request.url).searchParams.get("id") === `eq.${oil.id}`
          ? postgrestError(500, "XX000", "Olive oil is unavailable")
          : postgrestRows(request, [chicken]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({
        status: "error",
        debugMessage: "Could not load the foods of the recipe (XX000)",
      });
    });
  });

  it("should be an error that names the action and the code only when the recipe read fails", async () => {
    answerRefreshReads(server, { foods: [chicken, rice, oil] });
    server.use(
      http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({
        status: "error",
        debugMessage: "Could not load the recipe (XX000)",
      });
    });
  });

  describe("stale sensitivity", () => {
    it("should not show the last diff when the screen is opened again, and should read afresh", async () => {
      const reads = answerRefreshReads(server, { foods: [chicken, rice, oil] });
      const { queryClient, wrapper } = createWrapper();
      queryClient.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } });
      const first = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });
      await waitFor(() => {
        expect(first.result.current.status).toBe("ready");
      });
      first.unmount();
      await new Promise((resolve) => setTimeout(resolve, 20));

      const secondReads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
      const second = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

      expect(second.result.current).toEqual({ status: "loading" });
      await waitFor(() => {
        expect(second.result.current).toMatchObject({ status: "ready", hasChanges: true });
      });
      expect([reads.recipes, secondReads.recipes]).toEqual([1, 1]);
    });

    it("should read afresh for a screen that opens while another still shows it", async () => {
      const reads = answerRefreshReads(server, { foods: [chicken, rice, oil] });
      const { queryClient, wrapper } = createWrapper();
      queryClient.setDefaultOptions({ queries: { staleTime: 60_000, retry: false } });
      const first = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });
      await waitFor(() => {
        expect(first.result.current.status).toBe("ready");
      });

      renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });

      await waitFor(() => {
        expect(reads.recipes).toBe(2);
      });
    });

    it("should read afresh when the recipes are invalidated, as after an apply", async () => {
      const reads = answerRefreshReads(server, { foods: [chicken, rice, oil] });
      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => useRecipeRefreshPreview(RECIPE_ID), { wrapper });
      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      await queryClient.invalidateQueries({ queryKey: keys.recipes.all });

      expect(reads.recipes).toBe(2);
    });
  });
});
