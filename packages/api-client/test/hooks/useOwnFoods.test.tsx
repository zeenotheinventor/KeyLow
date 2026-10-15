import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useCreateFood } from "../../src/hooks/useCreateFood";
import { useDeleteFood } from "../../src/hooks/useDeleteFood";
import { useOwnFoods } from "../../src/hooks/useOwnFoods";
import { useUpdateFood } from "../../src/hooks/useUpdateFood";
import { keys } from "../../src/queryKeys";
import { OWN_FOODS_PAGE_SIZE } from "../../src/repos/foods";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  foodRow,
  portionRow,
  postgrestError,
  postgrestRows,
  signInAs,
} from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { Food } from "@keylow/core/schemas";

const server = setupServer();

let listRequests = 0;
// What the list endpoint answers. A test changes it to stand in for the database changing.
let storedFoods: Food[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  listRequests = 0;
  storedFoods = [];
  server.use(
    http.get(`${REST_URL}/foods`, ({ request }) => {
      listRequests += 1;
      // Answers the page the request asks for, as PostgREST does for `offset` and `limit`.
      const { searchParams } = new URL(request.url);
      const offset = Number(searchParams.get("offset") ?? 0);
      const limit = Number(searchParams.get("limit") ?? storedFoods.length);
      return postgrestRows(request, storedFoods.slice(offset, offset + limit));
    }),
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.post(`${REST_URL}/foods`, ({ request }) =>
      postgrestRows(request, [foodRow({ name: "Protein flapjack" })], 201),
    ),
    http.post(`${REST_URL}/food_portions`, ({ request }) =>
      postgrestRows(request, [portionRow()], 201),
    ),
    http.patch(`${REST_URL}/foods`, ({ request }) =>
      postgrestRows(request, [foodRow({ name: "Renamed flapjack" })]),
    ),
    http.delete(`${REST_URL}/food_portions`, () => new Response(null, { status: 204 })),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// Names sort in the order of their numbers, so the stored list is already in the order the database answers.
const manyFoods = (count: number): Food[] =>
  Array.from({ length: count }, (_, index) =>
    foodRow({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      name: `Food ${String(index).padStart(4, "0")}`,
    }),
  );

const validInput = {
  name: "Protein flapjack",
  basis: "per_100g",
  kcal: 410,
  protein_g: 22,
  fat_g: 14,
  carbs_g: 45,
  portions: [{ label: "1 bar", grams: 60, isDefault: true }],
};

async function renderOwnFoods() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  const hook = renderHook(
    () => ({
      own: useOwnFoods(),
      create: useCreateFood(),
      update: useUpdateFood(),
      remove: useDeleteFood(),
    }),
    { wrapper: rendered.wrapper },
  );
  return { ...rendered, ...hook };
}

describe("useOwnFoods", () => {
  it("should load the caller's own foods", async () => {
    storedFoods = [foodRow()];
    const { result } = await renderOwnFoods();

    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
    });
    expect(result.current.own.data).toEqual([foodRow()]);
  });

  it("should load one page first and say there is more when the page is full", async () => {
    storedFoods = manyFoods(OWN_FOODS_PAGE_SIZE + 1);
    const { result } = await renderOwnFoods();

    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
    });
    expect(result.current.own.data).toEqual(storedFoods.slice(0, OWN_FOODS_PAGE_SIZE));
    expect(result.current.own.hasNextPage).toBe(true);
    expect(listRequests).toBe(1);
  });

  it("should say there is no more when the page is not full", async () => {
    storedFoods = manyFoods(OWN_FOODS_PAGE_SIZE - 1);
    const { result } = await renderOwnFoods();

    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
    });
    expect(result.current.own.hasNextPage).toBe(false);
  });

  it("should reach the last food of more than 200 by loading the next pages in order", async () => {
    storedFoods = manyFoods(230);
    const { result } = await renderOwnFoods();
    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
    });

    while (result.current.own.hasNextPage) {
      await act(() => result.current.own.fetchNextPage());
    }

    expect(result.current.own.data).toEqual(storedFoods);
    expect(result.current.own.data?.at(-1)?.name).toBe("Food 0229");
    expect(listRequests).toBe(5);
  });

  it("should list a food once when it is read at the end of one page and the start of the next", async () => {
    const foods = manyFoods(OWN_FOODS_PAGE_SIZE + 2);
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset"));
        // The last food of the first page is read again at the start of the second.
        return postgrestRows(
          request,
          offset === 0 ? foods.slice(0, OWN_FOODS_PAGE_SIZE) : foods.slice(OWN_FOODS_PAGE_SIZE - 1),
        );
      }),
    );
    const { result } = await renderOwnFoods();
    await waitFor(() => {
      expect(result.current.own.data).toHaveLength(OWN_FOODS_PAGE_SIZE);
    });

    await act(() => result.current.own.fetchNextPage());

    await waitFor(() => {
      expect(result.current.own.data).toEqual(foods);
    });
  });

  it("should refresh every page it has loaded after a food is created", async () => {
    storedFoods = manyFoods(OWN_FOODS_PAGE_SIZE + 10);
    const { result } = await renderOwnFoods();
    await waitFor(() => {
      expect(result.current.own.data).toHaveLength(OWN_FOODS_PAGE_SIZE);
    });
    await act(() => result.current.own.fetchNextPage());
    await waitFor(() => {
      expect(result.current.own.data).toHaveLength(OWN_FOODS_PAGE_SIZE + 10);
    });

    storedFoods = [
      foodRow({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "A first food" }),
    ].concat(storedFoods);
    await act(() => result.current.create.mutateAsync(validInput));

    await waitFor(() => {
      expect(result.current.own.data).toEqual(storedFoods);
    });
  });

  it("should drop a food from the list after it is deleted", async () => {
    storedFoods = manyFoods(3);
    const { result } = await renderOwnFoods();
    await waitFor(() => {
      expect(result.current.own.data).toEqual(storedFoods);
    });
    const [deleted, ...remaining] = storedFoods;

    storedFoods = remaining;
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [{ ...deleted, deleted_at: "2026-10-15T10:00:00+00:00" }]),
      ),
    );
    await act(() => result.current.remove.mutateAsync(deleted?.id ?? ""));

    await waitFor(() => {
      expect(result.current.own.data).toEqual(remaining);
    });
  });

  it("should resolve to an empty list for a user with no foods", async () => {
    const { result } = await renderOwnFoods();

    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
    });
    expect(result.current.own.data).toEqual([]);
  });

  it("should cache the list under the own foods key", async () => {
    storedFoods = [foodRow()];
    const { queryClient, result } = await renderOwnFoods();

    await waitFor(() => {
      expect(result.current.own.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.foods.own)).toEqual({
      pages: [[foodRow()]],
      pageParams: [0],
    });
  });

  it("should expose the error when loading fails", async () => {
    server.use(
      http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { result } = await renderOwnFoods();

    await waitFor(() => {
      expect(result.current.own.isError).toBe(true);
    });
    expect(result.current.own.error).toHaveProperty("cause.message", "database unavailable");
  });

  it("should refresh the list after a food is created", async () => {
    const { result } = await renderOwnFoods();
    await waitFor(() => {
      expect(result.current.own.data).toEqual([]);
    });
    expect(listRequests).toBe(1);

    storedFoods = [foodRow({ name: "Protein flapjack" })];
    await act(() => result.current.create.mutateAsync(validInput));

    await waitFor(() => {
      expect(result.current.own.data).toEqual(storedFoods);
    });
    expect(listRequests).toBe(2);
  });

  it("should refresh the list after a food is updated", async () => {
    storedFoods = [foodRow({ name: "Protein flapjack" })];
    const { result } = await renderOwnFoods();
    await waitFor(() => {
      expect(result.current.own.data).toEqual(storedFoods);
    });

    storedFoods = [foodRow({ name: "Renamed flapjack" })];
    await act(() =>
      result.current.update.mutateAsync({
        id: foodRow().id,
        input: { ...validInput, name: "Renamed flapjack" },
      }),
    );

    await waitFor(() => {
      expect(result.current.own.data).toEqual(storedFoods);
    });
    expect(listRequests).toBe(2);
  });
});
