import { describe, expect, it } from "vitest";

import { planShoppingDraftsOf, planShoppingOf } from "../../src/plans";

import type { PlanDayRow, PlanItemRow, PlanRow, PlanShoppingRecipe } from "../../src/plans";

const PORRIDGE_ID = "recipe-porridge";
const STEW_ID = "recipe-stew";

const recipeItem = (
  id: string,
  recipeId: string | null,
  leftoverOf: string | null = null,
): PlanItemRow => ({
  kind: "recipe",
  id,
  position: 0,
  slotTime: "19:00:00",
  recipeId,
  servings: 1,
  nutrients: {},
  leftoverOf,
  snapshot: {},
});

const foodItem = (
  id: string,
  foodId: string | null,
  grams: number,
  name = "Rice, boiled",
): PlanItemRow => ({
  kind: "food",
  id,
  position: 1,
  slotTime: "12:30:00",
  foodId,
  grams,
  nutrients: {},
  leftoverOf: null,
  snapshot: { name },
});

const day = (
  localDate: string,
  items: PlanItemRow[],
  confirmedAt: string | null = null,
): PlanDayRow => ({
  id: `day-${localDate}`,
  localDate,
  target: {},
  confirmedAt,
  items,
});

const plan = (days: PlanDayRow[], extra: Partial<PlanRow> = {}): PlanRow => ({
  id: "plan-1",
  startDate: "2026-11-16",
  dayCount: 7,
  createdAt: "2026-11-13T10:00:00Z",
  days,
  ...extra,
});

const WEEK = { start: "2026-11-16", end: "2026-11-22" };

describe("planShoppingOf", () => {
  it("should be null when no day in the scope has anything left to buy", () => {
    const confirmed = day("2026-11-16", [foodItem("a", "rice", 100)], "2026-11-16T09:00:00Z");
    const empty = day("2026-11-17", []);

    expect(planShoppingOf([plan([confirmed, empty])], WEEK)).toBeNull();
    expect(
      planShoppingOf([plan([day("2026-11-30", [foodItem("a", "rice", 100)])])], WEEK),
    ).toBeNull();
  });

  it("should name the first and last day that has something to buy, leaving confirmed days out", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-16", [foodItem("a", "rice", 100)], "2026-11-16T09:00:00Z"),
          day("2026-11-18", [foodItem("b", "rice", 100)]),
          day("2026-11-19", []),
          day("2026-11-22", [foodItem("c", "rice", 100)]),
        ]),
      ],
      WEEK,
    );

    expect(shopping?.firstDate).toBe("2026-11-18");
    expect(shopping?.lastDate).toBe("2026-11-22");
  });

  it("should buy only the days in the scope, so one day is one day", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-18", [foodItem("b", "rice", 100)]),
          day("2026-11-19", [foodItem("c", "oats", 50)]),
        ]),
      ],
      { start: "2026-11-19", end: "2026-11-19" },
    );

    expect(shopping?.foods.map(({ foodId }) => foodId)).toEqual(["oats"]);
    expect(shopping?.firstDate).toBe("2026-11-19");
    expect(shopping?.lastDate).toBe("2026-11-19");
  });

  it("should list each recipe and food to read once, with the name a food was planned under", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-18", [
            recipeItem("a", PORRIDGE_ID),
            foodItem("b", "rice", 100, "Rice, boiled"),
          ]),
          day("2026-11-19", [
            recipeItem("c", PORRIDGE_ID),
            foodItem("d", "rice", 50, "Rice, boiled"),
          ]),
        ]),
      ],
      WEEK,
    );

    expect(shopping?.recipeIds).toEqual([PORRIDGE_ID]);
    expect(shopping?.foods).toEqual([{ foodId: "rice", name: "Rice, boiled" }]);
  });

  it("should not read a recipe that only a leftover names", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-16", [recipeItem("cook", STEW_ID)]),
          day("2026-11-17", [recipeItem("left", STEW_ID, "cook")]),
        ]),
      ],
      { start: "2026-11-17", end: "2026-11-17" },
    );

    expect(shopping?.recipeIds).toEqual([]);
  });

  it("should leave out an item whose food or recipe was deleted, since it cannot be bought", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-18", [
            recipeItem("a", null),
            foodItem("b", null, 100),
            foodItem("c", "rice", 100),
          ]),
        ]),
      ],
      WEEK,
    );

    expect(shopping?.recipeIds).toEqual([]);
    expect(shopping?.foods.map(({ foodId }) => foodId)).toEqual(["rice"]);
  });

  it.each([
    ["older first", false],
    ["newer first", true],
  ])(
    "should take the newest plan's day for a date two plans cover, with %s",
    (_order, newerFirst) => {
      const older = plan([day("2026-11-18", [foodItem("old", "rice", 100)])]);
      const newer = plan([day("2026-11-18", [foodItem("new", "oats", 100)])], {
        id: "plan-2",
        createdAt: "2026-11-14T10:00:00Z",
      });

      const shopping = planShoppingOf(newerFirst ? [newer, older] : [older, newer], WEEK);

      expect(shopping?.foods.map(({ foodId }) => foodId)).toEqual(["oats"]);
    },
  );
});

const STEW: PlanShoppingRecipe = {
  id: STEW_ID,
  name: "Stew",
  servings: 2,
  ingredients: [
    {
      foodId: "beef",
      name: "Beef",
      food: { name: "Beef", food_group: null },
      quantity: 400,
      unit: "g",
      resolvedGrams: 400,
      portionLabel: null,
    },
  ],
};
const RICE_ROW = { id: "rice", name: "Rice, boiled", food_group: null };
const OIL_ROW = { id: "oil", name: "Oil, olive", food_group: null };

describe("planShoppingDraftsOf", () => {
  it("should buy a recipe once for the servings it makes when its leftover sits outside the scope", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-16", [recipeItem("cook", STEW_ID)]),
          day("2026-11-17", [recipeItem("left", STEW_ID, "cook")]),
        ]),
      ],
      { start: "2026-11-16", end: "2026-11-16" },
    );
    if (shopping === null) {
      throw new Error("There is something to buy");
    }

    const { items } = planShoppingDraftsOf(shopping, [STEW], []);

    expect(items.map(({ name, grams }) => [name, grams])).toEqual([["Beef", 400]]);
  });

  it("should buy nothing for a leftover whose cook is not in the scope", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-16", [recipeItem("cook", STEW_ID)]),
          day("2026-11-17", [recipeItem("left", STEW_ID, "cook")]),
        ]),
      ],
      { start: "2026-11-17", end: "2026-11-17" },
    );
    if (shopping === null) {
      throw new Error("There is something to buy");
    }

    expect(planShoppingDraftsOf(shopping, [], [])).toEqual({ items: [], staples: [] });
  });

  it("should add the grams of a food planned on its own over the days and set a staple aside", () => {
    const shopping = planShoppingOf(
      [
        plan([
          day("2026-11-18", [foodItem("a", "rice", 180), foodItem("o1", "oil", 5, "Oil, olive")]),
          day("2026-11-19", [foodItem("b", "rice", 250), foodItem("o2", "oil", 10, "Oil, olive")]),
        ]),
      ],
      WEEK,
    );
    if (shopping === null) {
      throw new Error("There is something to buy");
    }

    const { items, staples } = planShoppingDraftsOf(shopping, [], [RICE_ROW, OIL_ROW]);

    expect(items.map(({ name, grams, sources }) => [name, grams, sources])).toEqual([
      ["Rice, boiled", 430, []],
    ]);
    expect(staples.map(({ name, grams }) => [name, grams])).toEqual([["Oil, olive", 15]]);
  });

  it("should fall back to the name a food was planned under when the food cannot be read now", () => {
    const shopping = planShoppingOf(
      [plan([day("2026-11-18", [foodItem("a", "rice", 180)])])],
      WEEK,
    );
    if (shopping === null) {
      throw new Error("There is something to buy");
    }

    const { items } = planShoppingDraftsOf(shopping, [], []);

    expect(items.map(({ name, grams }) => [name, grams])).toEqual([["Rice, boiled", 180]]);
  });

  it("should throw a RangeError for a recipe it was not given, so nothing is half added", () => {
    const shopping = planShoppingOfRecipe();

    expect(() => planShoppingDraftsOf(shopping, [], [])).toThrow(RangeError);
  });
});

function planShoppingOfRecipe() {
  const shopping = planShoppingOf([plan([day("2026-11-18", [recipeItem("a", STEW_ID)])])], WEEK);
  if (shopping === null) {
    throw new Error("There is something to buy");
  }
  return shopping;
}
