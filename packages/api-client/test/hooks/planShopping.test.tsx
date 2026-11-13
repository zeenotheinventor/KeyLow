import { planShoppingOf } from "@keylow/core/plans";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAddPlanToList } from "../../src/hooks/useAddPlanToList";
import { usePlanShoppingPreview } from "../../src/hooks/usePlanShoppingPreview";
import {
  BEEF_ID,
  CHILLI_ID,
  OIL_ID,
  ONION_ID,
  RICE_ID,
  installShoppingListFake,
  shoppingItemRow,
} from "../support/shoppingList";
import { createWrapper } from "../support/wrapper";

import type { PlanDayRow, PlanItemRow, PlanRow, PlanShopping } from "@keylow/core/plans";

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

const chilli = (id: string, leftoverOf: string | null = null): PlanItemRow => ({
  kind: "recipe",
  id,
  position: 0,
  slotTime: "19:00:00",
  recipeId: CHILLI_ID,
  servings: 1,
  nutrients: {},
  leftoverOf,
  snapshot: {},
});

const food = (id: string, foodId: string, grams: number): PlanItemRow => ({
  kind: "food",
  id,
  position: 1,
  slotTime: "12:30:00",
  foodId,
  grams,
  nutrients: {},
  leftoverOf: null,
  snapshot: { name: "Planned name" },
});

const day = (localDate: string, items: PlanItemRow[], confirmedAt: string | null = null) =>
  ({ id: `day-${localDate}`, localDate, target: {}, confirmedAt, items }) satisfies PlanDayRow;

// Chilli serves 4 (500 g beef, 300 g onions, 5 g salt): cooked on the 18th with a leftover on the 19th, so it is
// bought for 2 servings, 250 g of beef and 150 g of onions. Rice and olive oil are planned on their own.
const PLAN: PlanRow = {
  id: "plan-1",
  startDate: "2026-11-16",
  dayCount: 7,
  createdAt: "2026-11-13T10:00:00Z",
  days: [
    day("2026-11-16", [food("c", RICE_ID, 999)], "2026-11-16T09:00:00Z"),
    day("2026-11-18", [chilli("cook"), food("a", RICE_ID, 180), food("o1", OIL_ID, 5)]),
    day("2026-11-19", [chilli("left", "cook"), food("b", RICE_ID, 250), food("o2", OIL_ID, 10)]),
  ],
};

const shoppingOf = (): PlanShopping => {
  const shopping = planShoppingOf([PLAN], { start: "2026-11-16", end: "2026-11-22" });
  if (shopping === null) {
    throw new Error("There is something to buy");
  }
  return shopping;
};

describe("usePlanShoppingPreview", () => {
  it("should give the sums core makes of the unconfirmed days and set the staples aside", async () => {
    installShoppingListFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePlanShoppingPreview(shoppingOf()), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      throw new Error("The preview must be ready");
    }
    expect(result.current.preview.items.map(({ name, grams }) => [name, grams])).toEqual([
      ["Beef mince", 250],
      ["Onions", 150],
      ["Rice, white, boiled", 430],
    ]);
    expect(result.current.preview.staples.map(({ name, grams }) => [name, grams])).toEqual([
      ["Salt", 2.5],
      ["Oil, olive", 15],
    ]);
  });

  it("should read nothing for a plan with nothing to buy", () => {
    const fake = installShoppingListFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePlanShoppingPreview(null), { wrapper });

    expect(result.current.status).toBe("loading");
    expect(fake.requests).toEqual([]);
  });

  it("should be an error with a retry when the recipes or foods cannot be read", async () => {
    const fake = installShoppingListFake(server);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePlanShoppingPreview(shoppingOf()), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
  });
});

describe("useAddPlanToList", () => {
  it("should merge into the open row and add the rest at the end, in one write, with the staples left out", async () => {
    const open = shoppingItemRow({ position: 3 });
    const fake = installShoppingListFake(server, [open]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPlanToList(), { wrapper });

    await act(() => result.current.mutateAsync({ shopping: shoppingOf() }));

    expect(fake.requests.filter(({ method }) => method === "RPC")).toHaveLength(1);
    expect(fake.rows.map(({ food_id, grams, position }) => [food_id, grams, position])).toEqual([
      [ONION_ID, 450, 3],
      [BEEF_ID, 250, 4],
      [RICE_ID, 430, 5],
    ]);
  });

  it("should add a staple the person chose to add anyway", async () => {
    const fake = installShoppingListFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPlanToList(), { wrapper });

    await act(() => result.current.mutateAsync({ shopping: shoppingOf(), addAnyway: [OIL_ID] }));

    expect(fake.rows.map(({ name, grams }) => [name, grams])).toEqual([
      ["Beef mince", 250],
      ["Onions", 150],
      ["Rice, white, boiled", 430],
      ["Oil, olive", 15],
    ]);
  });

  it("should add the same amounts again when it is run twice, as adding a recipe twice does", async () => {
    const fake = installShoppingListFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPlanToList(), { wrapper });

    await act(() => result.current.mutateAsync({ shopping: shoppingOf() }));
    await act(() => result.current.mutateAsync({ shopping: shoppingOf() }));

    expect(fake.rows.map(({ name, grams }) => [name, grams])).toEqual([
      ["Beef mince", 500],
      ["Onions", 300],
      ["Rice, white, boiled", 860],
    ]);
  });

  it("should write nothing and name the code only when a read fails", async () => {
    const fake = installShoppingListFake(server);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPlanToList(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ shopping: shoppingOf() }).catch(() => undefined);
    });

    expect(result.current.error?.message).toBe(
      "Could not load the recipes for your shopping list (XX000)",
    );
    expect(fake.requests.filter(({ method }) => method !== "GET")).toEqual([]);
  });
});
