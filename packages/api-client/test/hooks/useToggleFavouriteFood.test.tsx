import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FavouriteRuleError } from "../../src/errors";
import { useToggleFavouriteFood } from "../../src/hooks/useToggleFavouriteFood";
import { keys } from "../../src/queryKeys";
import { REST_URL, foodRow, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { FavouriteFood } from "../../src/repos/favourites";

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

const oats = foodRow();
const toast = foodRow({ id: "66666666-6666-4666-8666-666666666666", name: "Toast" });

const cachedOats: FavouriteFood = {
  foodId: oats.id,
  createdAt: "2026-11-03T09:00:00+00:00",
  food: oats,
};

function answerWrites(insert: () => Response = () => new Response(null, { status: 201 })) {
  server.use(
    http.post(`${REST_URL}/food_favourites`, async ({ request }) => {
      inserts.push(await request.clone().json());
      return insert();
    }),
    http.delete(`${REST_URL}/food_favourites`, ({ request }) => {
      deletes.push(new URL(request.url).searchParams.get("food_id"));
      return new Response(null, { status: 204 });
    }),
    http.get(`${REST_URL}/food_favourites`, ({ request }) => postgrestRows(request, listRows)),
  );
}

function renderToggle(cached: FavouriteFood[] | null = [cachedOats]) {
  const rendered = createWrapper();
  if (cached !== null) {
    rendered.queryClient.setQueryData(keys.foods.favourites, cached);
  }
  const hook = renderHook(() => useToggleFavouriteFood(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

const cachedFavourites = (queryClient: ReturnType<typeof createWrapper>["queryClient"]) =>
  queryClient.getQueryData<FavouriteFood[]>(keys.foods.favourites);

describe("useToggleFavouriteFood", () => {
  it("should add the food to the cache at once, newest first, and insert it", async () => {
    answerWrites();
    listRows = [
      { created_at: "2026-11-03T10:00:00+00:00", foods: toast },
      { created_at: cachedOats.createdAt, foods: oats },
    ];
    const { queryClient, result } = renderToggle();

    act(() => {
      result.current.mutate({ food: toast, favourite: true });
    });

    await waitFor(() => {
      expect(cachedFavourites(queryClient)?.map((favourite) => favourite.foodId)).toEqual([
        toast.id,
        oats.id,
      ]);
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(inserts).toEqual([{ food_id: toast.id }]);
  });

  it("should take the food out of the cache at once and delete it", async () => {
    answerWrites();
    const { queryClient, result } = renderToggle();

    act(() => {
      result.current.mutate({ food: oats, favourite: false });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(deletes).toEqual([`eq.${oats.id}`]);
    expect(cachedFavourites(queryClient)).toEqual([]);
  });

  it("should roll the cache back when the cap refuses the favourite", async () => {
    answerWrites(() => postgrestError(400, "KL004", "favourite_limit"));
    listRows = [{ created_at: cachedOats.createdAt, foods: oats }];
    const { queryClient, result } = renderToggle();

    await act(async () => {
      await result.current.mutateAsync({ food: toast, favourite: true }).catch(() => undefined);
    });

    expect(result.current.error).toBeInstanceOf(FavouriteRuleError);
    await waitFor(() => {
      expect(cachedFavourites(queryClient)?.map((favourite) => favourite.foodId)).toEqual([
        oats.id,
      ]);
    });
  });

  it("should leave an uncached list uncached when toggling", async () => {
    answerWrites();
    const { queryClient, result } = renderToggle(null);

    await act(() => result.current.mutateAsync({ food: toast, favourite: true }));

    expect(inserts).toEqual([{ food_id: toast.id }]);
    expect(cachedFavourites(queryClient)).toBeUndefined();
  });

  it("should refresh the favourites after the request settles", async () => {
    answerWrites();
    const { queryClient, result } = renderToggle();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync({ food: oats, favourite: false }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.foods.favourites });
  });
});
