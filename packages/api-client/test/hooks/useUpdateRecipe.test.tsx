import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useUpdateRecipe } from "../../src/hooks/useUpdateRecipe";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeDetailRow, recipeSummaryRow } from "../support/recipes";
import {
  chickenAndRiceSave,
  saveWithBadIngredient,
  seedDiaryQueries,
} from "../support/recipeWrites";
import { createWrapper } from "../support/wrapper";

import type { RecipeSave, RecipeUpdate } from "../../src/repos/recipeWrites";

const server = setupServer();

const update = (overrides: Partial<RecipeSave> = {}): RecipeUpdate => ({
  ...chickenAndRiceSave(overrides),
  id: RECIPE_ID,
});

let saves = 0;
let reads = 0;
let release: () => void = () => undefined;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  saves = 0;
  reads = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** Answers the save with the recipe's id and the read back with the recipe, holding the save until `release`. */
const answerSave = ({ held = false }: { held?: boolean } = {}) => {
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post(`${REST_URL}/rpc/save_recipe`, async () => {
      saves += 1;
      if (held) {
        await gate;
      }
      return HttpResponse.json(RECIPE_ID);
    }),
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      reads += 1;
      return postgrestRows(request, [recipeDetailRow()]);
    }),
  );
};

describe("useUpdateRecipe", () => {
  it("should save over the recipe it was given, in a single request", async () => {
    let body: unknown;
    server.use(
      http.post(`${REST_URL}/rpc/save_recipe`, async ({ request }) => {
        saves += 1;
        body = await request.clone().json();
        return HttpResponse.json(RECIPE_ID);
      }),
      http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [recipeDetailRow()])),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    await act(() => result.current.mutateAsync(update()));

    expect(saves).toBe(1);
    expect(body).toMatchObject({ p_recipe_id: RECIPE_ID });
  });

  it("should resolve to the stored recipe", async () => {
    answerSave();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    const created = await act(() => result.current.mutateAsync(update()));

    expect(created).toMatchObject({ id: RECIPE_ID, name: "Chicken and rice" });
    expect(created.ingredients).toHaveLength(3);
  });

  it("should replace the cached recipe with the stored one", async () => {
    answerSave();
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), recipeDetailRow({ name: "Old name" }));
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    await act(() => result.current.mutateAsync(update()));

    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toMatchObject({
      id: RECIPE_ID,
      name: "Chicken and rice",
    });
  });

  it("should mark every recipes query stale once the save settles", async () => {
    answerSave();
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.recipes.list(false), []);
    queryClient.setQueryData(keys.recipes.search("stew"), []);
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    await act(() => result.current.mutateAsync(update()));

    expect(queryClient.getQueryState(keys.recipes.list(false))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.recipes.search("stew"))?.isInvalidated).toBe(true);
  });

  it("should leave the cache as it was when the save fails, and still mark the recipes stale", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/save_recipe`, () => postgrestError(500, "XX000", "boom")),
    );
    const { queryClient, wrapper } = createWrapper();
    const library = [recipeSummaryRow()];
    queryClient.setQueryData(keys.recipes.list(false), library);
    const detail = recipeDetailRow({ name: "Old name" });
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), detail);
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(update()).catch((error: unknown) => error),
    );

    expect(failure).toEqual(new Error("Could not save the recipe (XX000)"));
    expect(queryClient.getQueryData(keys.recipes.list(false))).toBe(library);
    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toBe(detail);
    expect(queryClient.getQueryState(keys.recipes.list(false))?.isInvalidated).toBe(true);
  });

  it("should reject an invalid recipe with a RangeError and make no request", async () => {
    answerSave();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ ...saveWithBadIngredient(), id: RECIPE_ID })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect([saves, reads]).toEqual([0, 0]);
  });

  describe("a double press of Save", () => {
    it("should make one request and give both presses the same recipe", async () => {
      answerSave({ held: true });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

      let both: Promise<unknown[]> = Promise.resolve([]);
      await act(async () => {
        both = Promise.all([
          result.current.mutateAsync(update()),
          result.current.mutateAsync(update()),
        ]);
        await Promise.resolve();
        release();
        await both;
      });

      const [first, second] = await both;
      expect(saves).toBe(1);
      expect(first).toMatchObject({ id: RECIPE_ID });
      expect(second).toBe(first);
    });

    it("should save again once the first save has settled", async () => {
      answerSave();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

      await act(() => result.current.mutateAsync(update()));
      await act(() => result.current.mutateAsync(update()));

      expect(saves).toBe(2);
    });

    it("should save again after a save that failed", async () => {
      server.use(
        http.post(`${REST_URL}/rpc/save_recipe`, () => {
          saves += 1;
          return postgrestError(500, "XX000", "boom");
        }),
      );
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

      await act(() => result.current.mutateAsync(update()).catch(() => undefined));
      await act(() => result.current.mutateAsync(update()).catch(() => undefined));

      expect(saves).toBe(2);
    });
  });

  it("should leave every diary query as it was, on success and on failure", async () => {
    answerSave();
    const { queryClient, wrapper } = createWrapper();
    const expectDiaryUntouched = seedDiaryQueries(queryClient);
    const { result } = renderHook(() => useUpdateRecipe(), { wrapper });

    await act(() => result.current.mutateAsync(update()));
    expectDiaryUntouched();

    server.use(
      http.post(`${REST_URL}/rpc/save_recipe`, () => postgrestError(500, "XX000", "boom")),
    );
    await act(() => result.current.mutateAsync(update()).catch(() => undefined));
    expectDiaryUntouched();
  });
});
