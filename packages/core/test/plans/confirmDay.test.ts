import { describe, expect, it } from "vitest";

import { confirmInputsOfDay } from "../../src/plans";
import { buildFood } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary";
import type { PlanItemRow } from "../../src/plans";

const OATS = buildFood({ id: "11111111-1111-4111-8111-111111111111", name: "Porridge oats" });
const STEW: LoggableRecipe = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Stew",
  servings: 2,
  yield_grams: 700,
  computed: {
    total: { kcal: 800, protein_g: 40, fat_g: 20, carbs_g: 90, fibre_g: 8 },
    effectiveGrams: 700,
  },
};

const foodItem = (slotTime: string | null, grams: number, foodId: string | null): PlanItemRow => ({
  kind: "food",
  id: `item-${grams}`,
  position: 0,
  slotTime,
  foodId,
  grams,
  nutrients: {},
  leftoverOf: null,
  snapshot: {},
});

const recipeItem = (slotTime: string | null, recipeId: string | null): PlanItemRow => ({
  kind: "recipe",
  id: "item-recipe",
  position: 1,
  slotTime,
  recipeId,
  servings: 1,
  nutrients: {},
  leftoverOf: null,
  snapshot: {},
});

const foods = new Map([[OATS.id, OATS]]);
const recipes = new Map([[STEW.id, STEW]]);

describe("confirmInputsOfDay", () => {
  it("should log each food in grams and each recipe by serving, at the item's time in the person's zone", () => {
    const inputs = confirmInputsOfDay({
      localDate: "2026-11-18",
      timeZone: "Europe/London",
      items: [foodItem("07:30:00", 50, OATS.id), recipeItem("19:00:00", STEW.id)],
      foods,
      recipes,
    });

    expect(inputs).toEqual([
      {
        kind: "food",
        input: {
          food: OATS,
          quantity: 50,
          unit: "g",
          loggedAt: "2026-11-18T07:30:00.000Z",
          localDate: "2026-11-18",
        },
      },
      {
        kind: "recipe",
        input: {
          recipe: STEW,
          quantity: 1,
          unit: "serving",
          loggedAt: "2026-11-18T19:00:00.000Z",
          localDate: "2026-11-18",
        },
      },
    ]);
  });

  it("should read a time on the wall clock of the zone, so summer time moves the instant", () => {
    const [first] = confirmInputsOfDay({
      localDate: "2026-07-18",
      timeZone: "Europe/London",
      items: [foodItem("07:30:00", 50, OATS.id)],
      foods,
      recipes,
    });

    expect(first?.input.loggedAt).toBe("2026-07-18T06:30:00.000Z");
  });

  it("should log an item with no time at midday", () => {
    const [first] = confirmInputsOfDay({
      localDate: "2026-11-18",
      timeZone: "UTC",
      items: [foodItem(null, 50, OATS.id)],
      foods,
      recipes,
    });

    expect(first?.input.loggedAt).toBe("2026-11-18T12:30:00.000Z");
  });

  it("should refuse a day with a food that is no longer there, naming no value", () => {
    const attempt = () =>
      confirmInputsOfDay({
        localDate: "2026-11-18",
        timeZone: "UTC",
        items: [foodItem("07:30:00", 123, "99999999-9999-4999-8999-999999999999")],
        foods,
        recipes,
      });

    expect(attempt).toThrow(RangeError);
    expect(attempt).toThrow("A planned food is no longer available");
  });

  it("should refuse an item whose recipe was deleted", () => {
    expect(() =>
      confirmInputsOfDay({
        localDate: "2026-11-18",
        timeZone: "UTC",
        items: [recipeItem("19:00:00", null)],
        foods,
        recipes,
      }),
    ).toThrow("A planned recipe is no longer available");
  });
});
