import { describe, expect, it } from "vitest";

import { aggregateIngredients } from "../../src/shopping";

import type { ShoppingIngredient, ShoppingRecipe } from "../../src/shopping";

const CHILLI_ID = "11111111-1111-4111-8111-111111111111";
const CURRY_ID = "22222222-2222-4222-8222-222222222222";
const ONION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BEEF_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SALT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const grams = (foodId: string, name: string, amount: number, food_group: string | null = null) =>
  ({
    foodId,
    name,
    food: { name, food_group },
    quantity: amount,
    unit: "g",
    resolvedGrams: amount,
    portionLabel: null,
  }) satisfies ShoppingIngredient;

const portions = (foodId: string, name: string, count: number, label: string, each: number) =>
  ({
    foodId,
    name,
    food: { name, food_group: "DG" },
    quantity: count,
    unit: "portion",
    resolvedGrams: count * each,
    portionLabel: label,
  }) satisfies ShoppingIngredient;

const recipe = (
  recipeId: string,
  recipeName: string,
  ingredients: ShoppingIngredient[],
  servings = { recipe: 4, chosen: 4 },
): ShoppingRecipe => ({
  recipeId,
  recipeName,
  recipeServings: servings.recipe,
  chosenServings: servings.chosen,
  ingredients,
});

describe("aggregateIngredients", () => {
  it("should sum one food across two recipes and name both", () => {
    const { items } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [grams(BEEF_ID, "Beef mince", 500)]),
      recipe(CURRY_ID, "Curry", [grams(BEEF_ID, "Beef mince", 250)]),
    ]);

    expect(items).toEqual([
      {
        foodId: BEEF_ID,
        name: "Beef mince",
        grams: 750,
        portionLabel: null,
        portionCount: null,
        sources: [
          { recipeId: CHILLI_ID, name: "Chilli" },
          { recipeId: CURRY_ID, name: "Curry" },
        ],
        rule: "default",
      },
    ]);
  });

  it("should scale by the servings chosen, so 2 of 4 servings halves every amount", () => {
    const { items } = aggregateIngredients([
      recipe(
        CHILLI_ID,
        "Chilli",
        [grams(BEEF_ID, "Beef mince", 500), portions(ONION_ID, "Onions", 2, "1 medium", 150)],
        { recipe: 4, chosen: 2 },
      ),
    ]);

    expect(items.map(({ grams: total, portionCount }) => [total, portionCount])).toEqual([
      [250, null],
      [150, 1],
    ]);
  });

  it("should keep the count while every ingredient of the food used the same portion", () => {
    const { items } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [portions(ONION_ID, "Onions", 2, "1 medium", 150)]),
      recipe(CURRY_ID, "Curry", [portions(ONION_ID, "Onions", 1, "1 medium", 150)]),
    ]);

    expect(items[0]).toMatchObject({ grams: 450, portionLabel: "1 medium", portionCount: 3 });
  });

  it("should drop the count when the portions differ, and keep the grams", () => {
    const { items } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [portions(ONION_ID, "Onions", 2, "1 medium", 150)]),
      recipe(CURRY_ID, "Curry", [portions(ONION_ID, "Onions", 1, "1 large", 200)]),
    ]);

    expect(items[0]).toMatchObject({ grams: 500, portionLabel: null, portionCount: null });
  });

  it("should drop the count when grams are mixed with a portion", () => {
    const { items } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [portions(ONION_ID, "Onions", 2, "1 medium", 150)]),
      recipe(CURRY_ID, "Curry", [grams(ONION_ID, "Onions", 100)]),
    ]);

    expect(items[0]).toMatchObject({ grams: 400, portionLabel: null, portionCount: null });
  });

  it("should put a store cupboard staple with the staples and not with the items", () => {
    const result = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [
        grams(SALT_ID, "Salt", 5, "WY"),
        grams(BEEF_ID, "Beef mince", 500),
      ]),
    ]);

    expect(result.items.map(({ name }) => name)).toEqual(["Beef mince"]);
    expect(result.staples.map(({ name, rule }) => [name, rule])).toEqual([["Salt", "staple_name"]]);
  });

  it("should sort by the frozen name with no group when the food cannot be read", () => {
    const { staples } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [{ ...grams(SALT_ID, "Salt", 5), food: null }]),
    ]);

    expect(staples.map(({ name }) => name)).toEqual(["Salt"]);
  });

  it("should name a recipe added twice once", () => {
    const { items } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [grams(BEEF_ID, "Beef mince", 500)]),
      recipe(CHILLI_ID, "Chilli", [grams(BEEF_ID, "Beef mince", 500)]),
    ]);

    expect(items[0]?.sources).toEqual([{ recipeId: CHILLI_ID, name: "Chilli" }]);
    expect(items[0]?.grams).toBe(1000);
  });

  it("should list the foods in the order they first appear", () => {
    const { items } = aggregateIngredients([
      recipe(CHILLI_ID, "Chilli", [
        grams(BEEF_ID, "Beef mince", 500),
        grams(ONION_ID, "Onions", 1),
      ]),
      recipe(CURRY_ID, "Curry", [grams(ONION_ID, "Onions", 1), grams(BEEF_ID, "Beef mince", 1)]),
    ]);

    expect(items.map(({ foodId }) => foodId)).toEqual([BEEF_ID, ONION_ID]);
  });

  it("should throw a RangeError for servings that cannot be chosen, before summing anything", () => {
    expect(() =>
      aggregateIngredients([
        recipe(CHILLI_ID, "Chilli", [grams(BEEF_ID, "Beef mince", 500)], { recipe: 4, chosen: 0 }),
      ]),
    ).toThrow(RangeError);
    expect(() =>
      aggregateIngredients([
        recipe(CHILLI_ID, "Chilli", [grams(BEEF_ID, "Beef mince", 500)], { recipe: 0, chosen: 2 }),
      ]),
    ).toThrow(RangeError);
  });

  it("should answer nothing for no recipes", () => {
    expect(aggregateIngredients([])).toEqual({ items: [], staples: [] });
  });
});
