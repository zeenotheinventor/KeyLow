import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useArchiveRecipe } from "../../src/hooks/useArchiveRecipe";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_ID, recipeDetailRow, recipeSummaryRow } from "../support/recipes";
import { seedDiaryQueries } from "../support/recipeWrites";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

/** The `is_archived` value of every update the server saw, in the order they arrived. */
let updates: boolean[] = [];
let releaseFirst: () => void = () => undefined;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  updates = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const answerUpdate = () => {
  server.use(
    http.patch(`${REST_URL}/recipes`, async ({ request }) => {
      const body: unknown = await request.clone().json();
      const archived =
        typeof body === "object" &&
        body !== null &&
        "is_archived" in body &&
        body.is_archived === true;
      updates.push(archived);
      return postgrestRows(request, [recipeSummaryRow({ is_archived: archived })]);
    }),
  );
};

describe("useArchiveRecipe", () => {
  it("should archive the recipe and resolve to it as stored", async () => {
    answerUpdate();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    const archived = await act(() => result.current.mutateAsync({ id: RECIPE_ID, archived: true }));

    expect(archived).toMatchObject({ id: RECIPE_ID, is_archived: true });
    expect(updates).toEqual([true]);
  });

  it("should restore the recipe with the same call and archived false, which is the Undo", async () => {
    answerUpdate();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    await act(() => result.current.mutateAsync({ id: RECIPE_ID, archived: true }));
    const restored = await act(() =>
      result.current.mutateAsync({ id: RECIPE_ID, archived: false }),
    );

    expect(restored).toMatchObject({ id: RECIPE_ID, is_archived: false });
    expect(updates).toEqual([true, false]);
  });

  it("should set the flag on the cached recipe and keep its ingredients and steps", async () => {
    answerUpdate();
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), recipeDetailRow());
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    await act(() => result.current.mutateAsync({ id: RECIPE_ID, archived: true }));

    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toEqual({
      ...recipeDetailRow(),
      is_archived: true,
    });
  });

  it("should not create a cache entry for a recipe that was not cached", async () => {
    answerUpdate();
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    await act(() => result.current.mutateAsync({ id: RECIPE_ID, archived: true }));

    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toBeUndefined();
  });

  it("should mark every recipes query stale once the update settles", async () => {
    answerUpdate();
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.recipes.list(false), [recipeSummaryRow()]);
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    await act(() => result.current.mutateAsync({ id: RECIPE_ID, archived: true }));

    expect(queryClient.getQueryState(keys.recipes.list(false))?.isInvalidated).toBe(true);
  });

  it("should leave the cache as it was when the update fails, and still mark the recipes stale", async () => {
    server.use(http.patch(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "boom")));
    const { queryClient, wrapper } = createWrapper();
    const detail = recipeDetailRow();
    queryClient.setQueryData(keys.recipes.detail(RECIPE_ID), detail);
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ id: RECIPE_ID, archived: true })
        .catch((error: unknown) => error),
    );

    expect(failure).toEqual(new Error("Could not archive the recipe (XX000)"));
    expect(queryClient.getQueryData(keys.recipes.detail(RECIPE_ID))).toBe(detail);
    expect(queryClient.getQueryState(keys.recipes.detail(RECIPE_ID))?.isInvalidated).toBe(true);
  });

  it("should run an Undo tapped while the archive is still on its way after it, and never before", async () => {
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    server.use(
      http.patch(`${REST_URL}/recipes`, async ({ request }) => {
        const body: unknown = await request.clone().json();
        const archived =
          typeof body === "object" &&
          body !== null &&
          "is_archived" in body &&
          body.is_archived === true;
        updates.push(archived);
        if (updates.length === 1) {
          await firstGate;
        }
        return postgrestRows(request, [recipeSummaryRow({ is_archived: archived })]);
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    let both: Promise<unknown[]> = Promise.resolve([]);
    act(() => {
      both = Promise.all([
        result.current.mutateAsync({ id: RECIPE_ID, archived: true }),
        result.current.mutateAsync({ id: RECIPE_ID, archived: false }),
      ]);
    });
    await waitFor(() => {
      expect(updates).toEqual([true]);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(updates).toEqual([true]);

    releaseFirst();
    await act(async () => {
      await both;
    });

    expect(updates).toEqual([true, false]);
  });

  it("should leave every diary query as it was, on success and on failure", async () => {
    answerUpdate();
    const { queryClient, wrapper } = createWrapper();
    const expectDiaryUntouched = seedDiaryQueries(queryClient);
    const { result } = renderHook(() => useArchiveRecipe(), { wrapper });

    await act(() => result.current.mutateAsync({ id: RECIPE_ID, archived: true }));
    expectDiaryUntouched();

    server.use(http.patch(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "boom")));
    await act(() =>
      result.current.mutateAsync({ id: RECIPE_ID, archived: false }).catch(() => undefined),
    );
    expectDiaryUntouched();
  });
});
