import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useCreateFood } from "../../src/hooks/useCreateFood";
import { useOwnFoods } from "../../src/hooks/useOwnFoods";
import { useUpdateFood } from "../../src/hooks/useUpdateFood";
import { keys } from "../../src/queryKeys";
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
      return postgrestRows(request, storedFoods);
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
    () => ({ own: useOwnFoods(), create: useCreateFood(), update: useUpdateFood() }),
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
    expect(queryClient.getQueryData(keys.foods.own)).toEqual([foodRow()]);
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
