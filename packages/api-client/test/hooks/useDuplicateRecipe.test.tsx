import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { useDuplicateRecipe } from "../../src/hooks/useDuplicateRecipe";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeDetailRow, recipeSummaryRow } from "../support/recipes";
import { seedDiaryQueries } from "../support/recipeWrites";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

/** The recipe name in the body of a `save_recipe` request. */
const savedNameOf = (body: unknown): string => {
  const parsed = z.object({ p_recipe: z.object({ name: z.string() }) }).parse(body);
  return parsed.p_recipe.name;
};

const COPY_ID = "66666666-6666-4666-8666-666666666666";

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
      return HttpResponse.json(COPY_ID);
    }),
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      reads += 1;
      const wantsCopy = new URL(request.url).searchParams.get("id") === `eq.${COPY_ID}`;
      return postgrestRows(request, [
        wantsCopy
          ? recipeDetailRow({ id: COPY_ID, name: "Chicken and rice (2)" })
          : recipeDetailRow(),
      ]);
    }),
  );
};

describe("useDuplicateRecipe", () => {
  it("should resolve to the stored recipe", async () => {
    answerSave();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

    const created = await act(() =>
      result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
    );

    expect(created).toMatchObject({ id: COPY_ID, name: "Chicken and rice (2)" });
    expect(created.ingredients).toHaveLength(3);
  });

  it("should put the copy in the cache under its own detail key and leave the original's alone", async () => {
    answerSave();
    const { queryClient, wrapper } = createWrapper();
    const original = recipeDetailRow();
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), original);
    const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
    );

    expect(queryClient.getQueryData(keys.recipes.detail(COPY_ID))).toMatchObject({
      id: COPY_ID,
      name: "Chicken and rice (2)",
    });
    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toBe(original);
  });

  it("should mark every recipes query stale once the save settles", async () => {
    answerSave();
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.recipes.list(false), []);
    queryClient.setQueryData(keys.recipes.search("stew"), []);
    const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
    );

    expect(queryClient.getQueryState(keys.recipes.list(false))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.recipes.search("stew"))?.isInvalidated).toBe(true);
  });

  it("should leave the cache as it was when the save fails, and still mark the recipes stale", async () => {
    answerSave();
    server.use(
      http.post(`${REST_URL}/rpc/save_recipe`, () => postgrestError(500, "XX000", "boom")),
    );
    const { queryClient, wrapper } = createWrapper();
    const library = [recipeSummaryRow()];
    queryClient.setQueryData(keys.recipes.list(false), library);
    const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" })
        .catch((error: unknown) => error),
    );

    expect(failure).toEqual(new Error("Could not save the recipe (XX000)"));
    expect(queryClient.getQueryData(keys.recipes.list(false))).toBe(library);
    expect(queryClient.getQueryData(keys.recipes.detail(COPY_ID))).toBeUndefined();
    expect(queryClient.getQueryState(keys.recipes.list(false))?.isInvalidated).toBe(true);
  });

  it("should reject a blank name with a RangeError and make no request", async () => {
    answerSave();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ recipeId: RECIPE_ID, name: "  " })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect([saves, reads]).toEqual([0, 0]);
  });

  describe("a double press of Save", () => {
    it("should make one request and give both presses the same recipe", async () => {
      answerSave({ held: true });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

      let both: Promise<unknown[]> = Promise.resolve([]);
      await act(async () => {
        both = Promise.all([
          result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
          result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
        ]);
        await Promise.resolve();
        release();
        await both;
      });

      const [first, second] = await both;
      expect(saves).toBe(1);
      expect(first).toMatchObject({ id: COPY_ID });
      expect(second).toBe(first);
    });

    it("should run a different save after the pending one, and give each press its own result", async () => {
      const savedNames: string[] = [];
      let gate: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        gate = resolve;
      });
      server.use(
        http.post(`${REST_URL}/rpc/save_recipe`, async ({ request }) => {
          const body: unknown = await request.clone().json();
          savedNames.push(savedNameOf(body));
          if (savedNames.length === 1) {
            await held;
          }
          return HttpResponse.json(COPY_ID);
        }),
        http.get(`${REST_URL}/recipes`, ({ request }) => {
          const wantsCopy = new URL(request.url).searchParams.get("id") === `eq.${COPY_ID}`;
          return postgrestRows(request, [
            wantsCopy
              ? recipeDetailRow({ id: COPY_ID, name: savedNames.at(-1) ?? "" })
              : recipeDetailRow(),
          ]);
        }),
      );
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

      let both: Promise<unknown[]> = Promise.resolve([]);
      await act(async () => {
        both = Promise.all([
          result.current.mutateAsync({ recipeId: RECIPE_ID, name: "First" }),
          result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Second edit" }),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(savedNames).toEqual(["First"]);
        gate();
        await both;
      });

      const [first, second] = await both;
      expect(savedNames).toEqual(["First", "Second edit"]);
      expect(first).toMatchObject({ name: "First" });
      expect(second).toMatchObject({ name: "Second edit" });
    });

    it("should save again once the first save has settled", async () => {
      answerSave();
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

      await act(() =>
        result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
      );
      await act(() =>
        result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
      );

      expect(saves).toBe(2);
    });

    it("should save again after a save that failed", async () => {
      answerSave();
      server.use(
        http.post(`${REST_URL}/rpc/save_recipe`, () => {
          saves += 1;
          return postgrestError(500, "XX000", "boom");
        }),
      );
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

      await act(() =>
        result.current
          .mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" })
          .catch(() => undefined),
      );
      await act(() =>
        result.current
          .mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" })
          .catch(() => undefined),
      );

      expect(saves).toBe(2);
    });
  });

  it("should leave every diary query as it was, on success and on failure", async () => {
    answerSave();
    const { queryClient, wrapper } = createWrapper();
    const expectDiaryUntouched = seedDiaryQueries(queryClient);
    const { result } = renderHook(() => useDuplicateRecipe(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" }),
    );
    expectDiaryUntouched();

    answerSave();
    server.use(
      http.post(`${REST_URL}/rpc/save_recipe`, () => postgrestError(500, "XX000", "boom")),
    );
    await act(() =>
      result.current
        .mutateAsync({ recipeId: RECIPE_ID, name: "Chicken and rice (2)" })
        .catch(() => undefined),
    );
    expectDiaryUntouched();
  });
});
