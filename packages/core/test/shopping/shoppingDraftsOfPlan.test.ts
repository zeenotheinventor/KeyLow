import { describe, expect, it } from "vitest";

import { aggregateIngredients, shoppingDraftsOfPlan } from "../../src/shopping";

import type { PlanItem } from "../../src/plans";
import type { ShoppingIngredient, ShoppingRecipe } from "../../src/shopping";

const NO_NUTRIENTS = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fibre_g: 0 };

const grams = (foodId: string, name: string, amount: number): ShoppingIngredient => ({
  foodId,
  name,
  food: { name, food_group: null },
  quantity: amount,
  unit: "g",
  resolvedGrams: amount,
  portionLabel: null,
});

const STEW = {
  recipeId: "stew",
  recipeName: "Stew",
  recipeServings: 2,
  ingredients: [grams("beef", "Beef", 400), grams("onion", "Onion", 100)],
};
const FOODS = [
  { foodId: "rice", name: "Rice", food: { name: "Rice", food_group: null } },
  { foodId: "beef", name: "Beef", food: { name: "Beef", food_group: null } },
  { foodId: "oil", name: "Oil, olive", food: { name: "Oil, olive", food_group: null } },
];

const cook = (date: string, recipeId: string, key = `${date}/evening/${recipeId}`): PlanItem => ({
  key,
  kind: "recipe",
  recipeId,
  servings: 1,
  band: "evening",
  time: "19:00",
  nutrients: NO_NUTRIENTS,
  leftoverOf: null,
});
const leftover = (date: string, recipeId: string, of: string): PlanItem => ({
  ...cook(date, recipeId),
  leftoverOf: of,
});
const plain = (date: string, foodId: string, amount: number): PlanItem => ({
  key: `${date}/midday/${foodId}`,
  kind: "food",
  foodId,
  grams: amount,
  band: "midday",
  time: "12:30",
  nutrients: NO_NUTRIENTS,
  leftoverOf: null,
});

const stewRecipe = (chosenServings: number): ShoppingRecipe => ({
  ...STEW,
  chosenServings,
});

describe("shoppingDraftsOfPlan", () => {
  it("should buy a recipe once for the servings it makes, so leftovers are not bought twice", () => {
    const cooked = cook("2026-11-16", "stew");
    const result = shoppingDraftsOfPlan({
      days: [
        { isConfirmed: false, items: [cooked] },
        { isConfirmed: false, items: [leftover("2026-11-17", "stew", cooked.key)] },
      ],
      recipes: [STEW],
      foods: FOODS,
    });

    expect(result).toEqual(aggregateIngredients([stewRecipe(2)]));
  });

  it("should buy a recipe cooked for one serving at one serving", () => {
    const result = shoppingDraftsOfPlan({
      days: [{ isConfirmed: false, items: [cook("2026-11-16", "stew")] }],
      recipes: [STEW],
      foods: FOODS,
    });

    expect(result).toEqual(aggregateIngredients([stewRecipe(1)]));
  });

  it("should sum plain foods and add them to a recipe's food", () => {
    const result = shoppingDraftsOfPlan({
      days: [
        {
          isConfirmed: false,
          items: [
            cook("2026-11-16", "stew"),
            plain("2026-11-16", "beef", 150),
            plain("2026-11-16", "rice", 100),
          ],
        },
        { isConfirmed: false, items: [plain("2026-11-17", "rice", 80)] },
      ],
      recipes: [STEW],
      foods: FOODS,
    });

    const byFood = Object.fromEntries(result.items.map((item) => [item.foodId, item.grams]));
    expect(byFood).toEqual({ beef: 200 + 150, onion: 50, rice: 180 });
    expect(result.items.find((item) => item.foodId === "beef")?.sources).toEqual([
      { recipeId: "stew", name: "Stew" },
    ]);
    expect(result.items.find((item) => item.foodId === "rice")?.sources).toEqual([]);
  });

  it("should leave a store cupboard food out, as the existing list does", () => {
    const result = shoppingDraftsOfPlan({
      days: [
        {
          isConfirmed: false,
          items: [plain("2026-11-16", "oil", 10), plain("2026-11-17", "oil", 12)],
        },
      ],
      recipes: [],
      foods: FOODS,
    });

    expect(result.items).toEqual([]);
    expect(
      result.staples.map(({ foodId, grams: total, rule }) => ({ foodId, total, rule })),
    ).toEqual([{ foodId: "oil", total: 22, rule: "staple_name" }]);
  });

  it("should leave out a confirmed day", () => {
    const result = shoppingDraftsOfPlan({
      days: [
        { isConfirmed: true, items: [plain("2026-11-16", "rice", 100)] },
        { isConfirmed: false, items: [plain("2026-11-17", "rice", 80)] },
      ],
      recipes: [],
      foods: FOODS,
    });

    expect(result.items.map((item) => item.grams)).toEqual([80]);
  });

  it("should not buy a leftover whose cook is already confirmed", () => {
    const cooked = cook("2026-11-16", "stew");
    const result = shoppingDraftsOfPlan({
      days: [
        { isConfirmed: true, items: [cooked] },
        { isConfirmed: false, items: [leftover("2026-11-17", "stew", cooked.key)] },
      ],
      recipes: [STEW],
      foods: FOODS,
    });

    expect(result).toEqual({ items: [], staples: [] });
  });

  it("should cook a recipe twice when the plan cooks it twice", () => {
    const result = shoppingDraftsOfPlan({
      days: [
        { isConfirmed: false, items: [cook("2026-11-16", "stew")] },
        { isConfirmed: false, items: [cook("2026-11-18", "stew")] },
      ],
      recipes: [STEW],
      foods: FOODS,
    });

    expect(result).toEqual(aggregateIngredients([stewRecipe(1), stewRecipe(1)]));
  });

  it("should refuse a recipe or a food it has no figures for", () => {
    expect(() =>
      shoppingDraftsOfPlan({
        days: [{ isConfirmed: false, items: [cook("2026-11-16", "ghost")] }],
        recipes: [STEW],
        foods: FOODS,
      }),
    ).toThrow(RangeError);
    expect(() =>
      shoppingDraftsOfPlan({
        days: [{ isConfirmed: false, items: [plain("2026-11-16", "ghost", 10)] }],
        recipes: [],
        foods: FOODS,
      }),
    ).toThrow(RangeError);
  });
});
