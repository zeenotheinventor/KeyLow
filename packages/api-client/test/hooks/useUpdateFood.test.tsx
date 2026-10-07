import { act, renderHook } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomFoodValidationError } from "../../src/customFoodInput";
import { useUpdateFood } from "../../src/hooks/useUpdateFood";
import { keys } from "../../src/queryKeys";
import { REST_URL, foodRow, portionRow, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

let requests: string[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  requests = [];
  server.use(
    http.patch(`${REST_URL}/foods`, ({ request }) => {
      requests.push("PATCH foods");
      return postgrestRows(request, [foodRow({ name: "Renamed flapjack" })]);
    }),
    http.delete(`${REST_URL}/food_portions`, () => {
      requests.push("DELETE food_portions");
      return new Response(null, { status: 204 });
    }),
    http.post(`${REST_URL}/food_portions`, ({ request }) => {
      requests.push("POST food_portions");
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

const FOOD_ID = foodRow().id;

const validInput = {
  name: "Renamed flapjack",
  basis: "per_100g",
  kcal: 410,
  protein_g: 22,
  fat_g: 14,
  carbs_g: 45,
  portions: [{ label: "1 bar", grams: 60, isDefault: true }],
};

function renderUpdateFood() {
  const rendered = createWrapper();
  const hook = renderHook(() => useUpdateFood(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

describe("useUpdateFood", () => {
  it("should update the food and replace its portions", async () => {
    const { result } = renderUpdateFood();

    const food = await act(() => result.current.mutateAsync({ id: FOOD_ID, input: validInput }));

    expect(food.name).toBe("Renamed flapjack");
    expect(requests).toEqual(["PATCH foods", "DELETE food_portions", "POST food_portions"]);
  });

  it("should reject invalid input with a validation error and never call the network", async () => {
    const { result } = renderUpdateFood();

    const failure = await act(() =>
      result.current
        .mutateAsync({ id: FOOD_ID, input: { ...validInput, kcal: -5 } })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(CustomFoodValidationError);
    expect(requests).toEqual([]);
  });

  it("should invalidate every foods query once, which covers the detail and portions keys", async () => {
    const { queryClient, result } = renderUpdateFood();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() => result.current.mutateAsync({ id: FOOD_ID, input: validInput }));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.foods.all });
  });

  it("should invalidate every foods query and name the food when only the portions were not saved", async () => {
    server.use(
      http.post(`${REST_URL}/food_portions`, () =>
        postgrestError(403, "42501", "new row violates row-level security policy"),
      ),
    );
    const { queryClient, result } = renderUpdateFood();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const failure = await act(() =>
      result.current
        .mutateAsync({ id: FOOD_ID, input: validInput })
        .catch((error: unknown) => error),
    );

    expect(failure).toHaveProperty("message", expect.stringContaining(FOOD_ID));
    expect(requests).toEqual(["PATCH foods", "DELETE food_portions"]);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.foods.all });
  });

  it("should not invalidate anything when the update fails", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { queryClient, result } = renderUpdateFood();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await act(() =>
      result.current.mutateAsync({ id: FOOD_ID, input: validInput }).catch(() => undefined),
    );

    expect(invalidate).not.toHaveBeenCalled();
  });
});
