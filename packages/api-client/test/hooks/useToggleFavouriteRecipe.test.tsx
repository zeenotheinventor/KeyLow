import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FavouriteRuleError } from "../../src/errors";
import { useToggleFavouriteRecipe } from "../../src/hooks/useToggleFavouriteRecipe";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { recipeSummaryRow } from "../support/recipes";
import { createWrapper } from "../support/wrapper";

import type { FavouriteRecipe } from "../../src/repos/favourites";

const server = setupServer();

let inserts: unknown[] = [];
let deletes: Array<string | null> = [];
let listRows: unknown[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  inserts = [];
  deletes = [];
  listRows = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const stew = recipeSummaryRow({ name: "Stew" });
const curry = recipeSummaryRow({ id: "66666666-6666-4666-8666-666666666666", name: "Curry" });
const chilli = recipeSummaryRow({ id: "77777777-7777-4777-8777-777777777777", name: "Chilli" });

const cachedStew: FavouriteRecipe = {
  recipeId: stew.id,
  createdAt: "2026-11-03T09:00:00+00:00",
  recipe: stew,
};

function answerWrites(
  insert: () => Response | Promise<Response> = () => new Response(null, { status: 201 }),
  { responseDelayMs = 0 }: { responseDelayMs?: number } = {},
) {
  server.use(
    http.post(`${REST_URL}/recipe_favourites`, async ({ request }) => {
      inserts.push(await request.clone().json());
      await delay(responseDelayMs);
      return insert();
    }),
    http.delete(`${REST_URL}/recipe_favourites`, async ({ request }) => {
      deletes.push(new URL(request.url).searchParams.get("recipe_id"));
      await delay(responseDelayMs);
      return new Response(null, { status: 204 });
    }),
    http.get(`${REST_URL}/recipe_favourites`, ({ request }) => postgrestRows(request, listRows)),
  );
}

function renderToggle(cached: FavouriteRecipe[] | null = [cachedStew]) {
  const rendered = createWrapper();
  if (cached !== null) {
    rendered.queryClient.setQueryData(keys.recipes.favourites, cached);
  }
  const hook = renderHook(() => useToggleFavouriteRecipe(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

const cachedFavourites = (queryClient: ReturnType<typeof createWrapper>["queryClient"]) =>
  queryClient.getQueryData<FavouriteRecipe[]>(keys.recipes.favourites);

describe("useToggleFavouriteRecipe", () => {
  it("should add the recipe to the cache at once, newest first, and insert it", async () => {
    answerWrites(undefined, { responseDelayMs: 200 });
    listRows = [
      { created_at: "2026-11-03T10:00:00+00:00", recipes: curry },
      { created_at: cachedStew.createdAt, recipes: stew },
    ];
    const { queryClient, result } = renderToggle();

    act(() => {
      result.current.mutate({ recipe: curry, favourite: true });
    });

    await waitFor(() => {
      expect(cachedFavourites(queryClient)?.map((favourite) => favourite.recipeId)).toEqual([
        curry.id,
        stew.id,
      ]);
    });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(inserts).toEqual([{ recipe_id: curry.id }]);
  });

  it("should take the recipe out of the cache at once and delete it", async () => {
    answerWrites(undefined, { responseDelayMs: 200 });
    const { queryClient, result } = renderToggle();

    act(() => {
      result.current.mutate({ recipe: stew, favourite: false });
    });

    await waitFor(() => {
      expect(cachedFavourites(queryClient)).toEqual([]);
    });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(deletes).toEqual([`eq.${stew.id}`]);
    expect(cachedFavourites(queryClient)).toEqual([]);
  });

  it("should roll the cache back when the cap refuses the favourite", async () => {
    answerWrites(() => postgrestError(400, "KL004", "favourite_limit"));
    listRows = [{ created_at: cachedStew.createdAt, recipes: stew }];
    const { queryClient, result } = renderToggle();

    await act(async () => {
      await result.current.mutateAsync({ recipe: curry, favourite: true }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(FavouriteRuleError);
    });
    await waitFor(() => {
      expect(cachedFavourites(queryClient)?.map((favourite) => favourite.recipeId)).toEqual([
        stew.id,
      ]);
    });
  });

  it("should leave an uncached list uncached when toggling", async () => {
    answerWrites();
    const { queryClient, result } = renderToggle(null);

    await act(() => result.current.mutateAsync({ recipe: curry, favourite: true }));

    expect(inserts).toEqual([{ recipe_id: curry.id }]);
    expect(cachedFavourites(queryClient)).toBeUndefined();
  });

  it("should refresh the favourites after the request settles", async () => {
    answerWrites();
    const { queryClient, result } = renderToggle();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync({ recipe: stew, favourite: false }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.recipes.favourites });
  });

  it("should refresh the favourite foods too once the request settles, because the cap is shared", async () => {
    answerWrites();
    const { queryClient, result } = renderToggle();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync({ recipe: stew, favourite: false }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.foods.favourites });
  });

  it("should put an unfavourited recipe back where it was when the delete fails", async () => {
    server.use(
      http.delete(`${REST_URL}/recipe_favourites`, () => postgrestError(500, "XX000", "failed")),
      http.get(`${REST_URL}/recipe_favourites`, ({ request }) =>
        postgrestRows(request, [{ created_at: cachedStew.createdAt, recipes: stew }]),
      ),
    );
    const { queryClient, result } = renderToggle();

    await act(async () => {
      await result.current.mutateAsync({ recipe: stew, favourite: false }).catch(() => undefined);
    });

    expect(cachedFavourites(queryClient)).toEqual([cachedStew]);
  });

  it("should keep a later tap's change when an earlier tap fails, and refresh once at the end", async () => {
    let releaseSecond = () => {};
    const secondMayAnswer = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let posts = 0;
    server.use(
      http.post(`${REST_URL}/recipe_favourites`, async () => {
        posts += 1;
        if (posts === 1) {
          await delay(50);
          return postgrestError(400, "KL004", "favourite_limit");
        }
        await secondMayAnswer;
        return new Response(null, { status: 201 });
      }),
      http.get(`${REST_URL}/recipe_favourites`, ({ request }) =>
        postgrestRows(request, [{ created_at: "2026-11-03T12:00:00+00:00", recipes: chilli }]),
      ),
    );
    const { queryClient, result } = renderToggle();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      result.current.mutate({ recipe: curry, favourite: true });
      result.current.mutate({ recipe: chilli, favourite: true });
    });
    await waitFor(() => {
      expect(cachedFavourites(queryClient)?.map((favourite) => favourite.recipeId)).toEqual([
        chilli.id,
        curry.id,
        stew.id,
      ]);
    });

    // The first tap fails and only its own recipe is taken out. The second is still on its way.
    await waitFor(() => {
      expect(posts).toBe(2);
    });
    expect(cachedFavourites(queryClient)?.map((favourite) => favourite.recipeId)).toEqual([
      chilli.id,
      stew.id,
    ]);
    expect(invalidate).not.toHaveBeenCalled();

    releaseSecond();
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledTimes(2);
    });
  });
});
