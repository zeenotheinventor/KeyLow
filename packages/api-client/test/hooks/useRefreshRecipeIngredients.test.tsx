import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRefreshRecipeIngredients } from "../../src/hooks/useRefreshRecipeIngredients";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError } from "../support/postgrest";
import { answerRefreshReads, chicken, oil, rice } from "../support/recipeRefresh";
import { RECIPE_ID, recipeDetailRow, recipeSummaryRow } from "../support/recipes";
import { seedDiaryQueries } from "../support/recipeWrites";
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

describe("useRefreshRecipeIngredients", () => {
  it("should save the rebuilt ingredients in a single request and resolve to the diff it applied", async () => {
    const reads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRefreshRecipeIngredients(), { wrapper });

    const applied = await act(() => result.current.mutateAsync(RECIPE_ID));

    expect(reads.saves).toHaveLength(1);
    expect(applied.hasChanges).toBe(true);
    expect(applied.changes.map(({ changed }) => changed)).toEqual([true, false, false]);
  });

  it("should mark every recipes query stale, the preview and the recipe included", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.recipes.list(false), [recipeSummaryRow()]);
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), recipeDetailRow());
    queryClient.setQueryData(keys.recipes.refresh(RECIPE_ID), { hasChanges: true });
    const { result } = renderHook(() => useRefreshRecipeIngredients(), { wrapper });

    await act(() => result.current.mutateAsync(RECIPE_ID));

    for (const key of [
      keys.recipes.list(false),
      keys.recipes.detail(RECIPE_ID),
      keys.recipes.refresh(RECIPE_ID),
    ]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });

  it("should leave the cache as it was when a food read fails, and still mark the recipes stale", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    server.use(http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "down")));
    const { queryClient, wrapper } = createWrapper();
    const detail = recipeDetailRow();
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), detail);
    const { result } = renderHook(() => useRefreshRecipeIngredients(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(RECIPE_ID).catch((error: unknown) => error),
    );

    expect(failure).toEqual(new Error("Could not load the foods of the recipe (XX000)"));
    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toBe(detail);
    expect(queryClient.getQueryState(keys.recipes.detail(RECIPE_ID))?.isInvalidated).toBe(true);
  });

  describe("a double press of Refresh", () => {
    it("should make one request and give both presses the same diff", async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const reads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
      server.use(
        http.post(`${REST_URL}/rpc/save_recipe`, async ({ request }) => {
          reads.saves.push(await request.clone().json());
          await gate;
          return HttpResponse.json(RECIPE_ID);
        }),
      );
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useRefreshRecipeIngredients(), { wrapper });

      let both: Promise<unknown[]> = Promise.resolve([]);
      await act(async () => {
        both = Promise.all([
          result.current.mutateAsync(RECIPE_ID),
          result.current.mutateAsync(RECIPE_ID),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 50));
        release();
        await both;
      });

      const [first, second] = await both;
      expect(reads.saves).toHaveLength(1);
      expect(reads.foodIds).toHaveLength(3);
      expect(second).toBe(first);
    });

    it("should refresh again once the first refresh has settled", async () => {
      const reads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useRefreshRecipeIngredients(), { wrapper });

      await act(() => result.current.mutateAsync(RECIPE_ID));
      await act(() => result.current.mutateAsync(RECIPE_ID));

      expect(reads.saves).toHaveLength(2);
    });
  });

  it("should leave every diary query as it was, on success and on failure", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    const { queryClient, wrapper } = createWrapper();
    const expectDiaryUntouched = seedDiaryQueries(queryClient);
    const { result } = renderHook(() => useRefreshRecipeIngredients(), { wrapper });

    await act(() => result.current.mutateAsync(RECIPE_ID));
    expectDiaryUntouched();

    server.use(http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "down")));
    await act(() => result.current.mutateAsync(RECIPE_ID).catch(() => undefined));
    expectDiaryUntouched();
  });
});
