import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomFoodValidationError } from "../../src/customFoodInput";
import { useCreateFood } from "../../src/hooks/useCreateFood";
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

const server = setupServer();

let authRequests = 0;
let foodInserts: unknown[] = [];
let portionInserts: unknown[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  authRequests = 0;
  foodInserts = [];
  portionInserts = [];
  server.use(
    http.get(AUTH_USER_URL, () => {
      authRequests += 1;
      return HttpResponse.json({
        id: SIGNED_IN_USER_ID,
        aud: "authenticated",
        role: "authenticated",
      });
    }),
    http.post(`${REST_URL}/foods`, async ({ request }) => {
      foodInserts.push(await request.clone().json());
      return postgrestRows(request, [foodRow()], 201);
    }),
    http.post(`${REST_URL}/food_portions`, async ({ request }) => {
      portionInserts.push(await request.clone().json());
      return postgrestRows(request, [portionRow()], 201);
    }),
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

async function renderSignedIn() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  authRequests = 0;
  const hook = renderHook(() => useCreateFood(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

describe("useCreateFood", () => {
  it("should create the food and its portions for the signed in user", async () => {
    const { result } = await renderSignedIn();

    const created = await act(() => result.current.mutateAsync(validInput));

    expect(created).toEqual({ food: foodRow(), portions: [portionRow()] });
    expect(foodInserts).toMatchObject([{ owner_id: SIGNED_IN_USER_ID, source: "user" }]);
    expect(portionInserts).toMatchObject([
      [{ owner_id: SIGNED_IN_USER_ID, food_id: foodRow().id, label: "1 bar" }],
    ]);
  });

  it("should reject invalid input with a validation error and never call the network", async () => {
    const { result } = await renderSignedIn();

    const failure = await act(() =>
      result.current.mutateAsync({ ...validInput, name: "" }).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(CustomFoodValidationError);
    expect(authRequests).toBe(0);
    expect(foodInserts).toEqual([]);
    expect(portionInserts).toEqual([]);
  });

  it("should reject when nobody is signed in and never write anything", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateFood(), { wrapper });

    const failure = await act(() =>
      result.current.mutateAsync(validInput).catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toHaveProperty("message", expect.stringMatching(/signed in/i));
    expect(foodInserts).toEqual([]);
  });

  it("should invalidate every foods query once the food is created", async () => {
    const { queryClient, result } = await renderSignedIn();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync(validInput));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate.mock.calls[0]?.[0]).toHaveProperty("queryKey", keys.foods.all);
  });

  it("should seed the detail and portions caches for the new food", async () => {
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(validInput));

    expect(queryClient.getQueryData(keys.foods.detail(foodRow().id))).toEqual(foodRow());
    expect(queryClient.getQueryData(keys.foods.portions(foodRow().id))).toEqual([portionRow()]);
  });

  it("should surface an error naming the food when its portions were not saved", async () => {
    server.use(
      http.post(`${REST_URL}/food_portions`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy"),
      ),
    );
    const { result } = await renderSignedIn();

    const failure = await act(() =>
      result.current.mutateAsync(validInput).catch((error: unknown) => error),
    );

    expect(failure).toHaveProperty("message", expect.stringContaining(foodRow().id));
  });

  it("should invalidate every foods query when only the portions were not saved, because the food exists", async () => {
    server.use(
      http.post(`${REST_URL}/food_portions`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy"),
      ),
    );
    const { queryClient, result } = await renderSignedIn();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync(validInput).catch(() => undefined));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate.mock.calls[0]?.[0]).toHaveProperty("queryKey", keys.foods.all);
  });

  it("should leave the caches alone when the food insert fails", async () => {
    server.use(
      http.post(`${REST_URL}/foods`, () => postgrestError(403, "42501", "permission denied")),
    );
    const { queryClient, result } = await renderSignedIn();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync(validInput).catch(() => undefined));

    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(keys.foods.detail(foodRow().id))).toBeUndefined();
  });
});
