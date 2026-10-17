import { describe, expect, it } from "vitest";

import { SPOON_PORTIONS } from "../../src/nutrition";
import {
  MAX_RECIPE_SERVINGS,
  buildRecipeIngredient,
  scaleFactor,
  scaleIngredientAmount,
  scaleYield,
} from "../../src/recipes";
import { buildChickenAndRiceRecipe, buildFood, buildFoodPortion } from "../../src/testing";

import type { QuantityUnit } from "../../src/nutrition";
import type { RecipeIngredient, RecipeIngredientInput } from "../../src/recipes";

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must include a teaspoon and a tablespoon");
}

const largeEgg = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b1",
  label: "1 large",
  grams: 50,
});

const ingredientIn = (
  unit: QuantityUnit,
  quantity: number,
  portion?: RecipeIngredientInput["portion"],
): RecipeIngredient =>
  buildRecipeIngredient(buildFood({ density_g_per_ml: 0.92 }), {
    quantity,
    unit,
    ...(portion === undefined ? {} : { portion }),
  });

describe("scaleFactor", () => {
  it.each([
    { chosen: 6, recipe: 4, factor: 1.5 },
    { chosen: 4, recipe: 4, factor: 1 },
    { chosen: 1, recipe: 4, factor: 0.25 },
    { chosen: 1000, recipe: 4, factor: 250 },
    { chosen: 1, recipe: 1, factor: 1 },
    { chosen: 3, recipe: 4, factor: 0.75 },
  ])(
    "should give $factor for $chosen servings of a recipe of $recipe",
    ({ chosen, recipe, factor }) => {
      expect(scaleFactor(chosen, recipe)).toBe(factor);
    },
  );

  describe("a recipe saved at fractional servings", () => {
    it("should give 1 when the chosen number is the recipe's own 2.5", () => {
      expect(scaleFactor(2.5, 2.5)).toBe(1);
    });

    it("should give 2 for 5 servings of a recipe of 2.5", () => {
      expect(scaleFactor(5, 2.5)).toBe(2);
    });

    it("should give 0.8 for 2 servings of a recipe of 2.5", () => {
      expect(scaleFactor(2, 2.5)).toBe(0.8);
    });
  });

  it("should accept the largest number of servings", () => {
    expect(scaleFactor(MAX_RECIPE_SERVINGS, 1)).toBe(1000);
  });

  it.each([
    { chosen: 0, label: "0" },
    { chosen: MAX_RECIPE_SERVINGS + 1, label: "1,001" },
    { chosen: 2.5, label: "2.5 when the recipe has 4 servings" },
    { chosen: -1, label: "a negative number" },
    { chosen: Number.NaN, label: "NaN" },
    { chosen: Number.POSITIVE_INFINITY, label: "infinity" },
  ])("should refuse $label as the chosen servings", ({ chosen }) => {
    expect(() => scaleFactor(chosen, 4)).toThrow(RangeError);
  });

  it.each([0, -4, Number.NaN, Number.POSITIVE_INFINITY])(
    "should refuse %s as the recipe's servings",
    (recipeServings) => {
      expect(() => scaleFactor(1, recipeServings)).toThrow(RangeError);
    },
  );

  it("should refuse the recipe's own servings when they are not above 0, even if chosen matches", () => {
    expect(() => scaleFactor(0, 0)).toThrow(RangeError);
  });

  it("should state the rule and never the servings in the message", () => {
    expect(() => scaleFactor(7.25, 4)).toThrow(/whole number/);
    expect(() => scaleFactor(7.25, 4)).not.toThrow(/7\.25/);
    expect(() => scaleFactor(1, -4.5)).toThrow(/above 0/);
    expect(() => scaleFactor(1, -4.5)).not.toThrow(/4\.5/);
  });
});

describe("scaleIngredientAmount", () => {
  describe("the chicken and rice golden, 4 to 6 servings", () => {
    const { ingredients } = buildChickenAndRiceRecipe();
    const factor = scaleFactor(6, 4);

    it("should give 750 g of chicken, 300 g of rice and 30 g of oil", () => {
      expect(ingredients.map((ingredient) => scaleIngredientAmount(ingredient, factor))).toEqual([
        { unit: "g", quantity: 750, resolvedGrams: 750, portion: null },
        { unit: "g", quantity: 300, resolvedGrams: 300, portion: null },
        { unit: "g", quantity: 30, resolvedGrams: 30, portion: null },
      ]);
    });

    it("should give the originals back when scaled to 6 and then to 4", () => {
      const scaledBack = ingredients.map((ingredient) => {
        const scaled = scaleIngredientAmount(ingredient, factor);
        return scaleIngredientAmount(
          { ...ingredient, quantity: scaled.quantity, resolved_grams: scaled.resolvedGrams },
          scaleFactor(4, 6),
        );
      });

      expect(scaledBack.map(({ quantity }) => quantity)).toEqual([500, 200, 20]);
      expect(scaledBack.map(({ resolvedGrams }) => resolvedGrams)).toEqual([500, 200, 20]);
    });
  });

  it("should scale a natural portion by count and by grams, keeping the portion (6 large eggs, 4 to 6)", () => {
    const eggs = ingredientIn("portion", 6, largeEgg);

    expect(scaleIngredientAmount(eggs, 1.5)).toEqual({
      unit: "portion",
      quantity: 9,
      resolvedGrams: 450,
      portion: { label: "1 large", grams: 50 },
    });
  });

  it("should keep a spoon a spoon (1 tbsp, 15 ml, 13.8 g)", () => {
    const oil = ingredientIn("portion", 1, tablespoon);
    const toSix = scaleIngredientAmount(oil, 1.5);
    const toOne = scaleIngredientAmount(oil, 0.25);

    expect(toSix.unit).toBe("portion");
    expect(toSix.portion).toEqual({ label: tablespoon.label, ml: 15 });
    expect(toSix.quantity).toBe(1.5);
    expect(toSix.resolvedGrams).toBeCloseTo(20.7, 9);
    expect(toOne.quantity).toBe(0.25);
    expect(toOne.resolvedGrams).toBeCloseTo(3.45, 9);
  });

  it("should not turn 3 teaspoons into a tablespoon", () => {
    const scaled = scaleIngredientAmount(ingredientIn("portion", 3, teaspoon), 1.5);

    expect(scaled.quantity).toBe(4.5);
    expect(scaled.portion?.label).toBe(teaspoon.label);
  });

  it("should scale millilitres and their grams (100 ml to 150 ml)", () => {
    const milk = ingredientIn("ml", 100);
    const scaled = scaleIngredientAmount(milk, 1.5);

    expect(scaled.unit).toBe("ml");
    expect(scaled.quantity).toBe(150);
    expect(scaled.resolvedGrams).toBeCloseTo(milk.resolved_grams * 1.5, 9);
    expect(scaled.portion).toBeNull();
  });

  it.each(["oz", "fl_oz"] as const)("should keep %s as the unit", (unit) => {
    const ingredient = ingredientIn(unit, 2);
    const scaled = scaleIngredientAmount(ingredient, 1.5);

    expect(scaled.unit).toBe(unit);
    expect(scaled.quantity).toBe(3);
    expect(scaled.resolvedGrams).toBeCloseTo(ingredient.resolved_grams * 1.5, 9);
  });

  it("should return the ingredient unchanged at factor 1", () => {
    const ingredient = ingredientIn("portion", 6, largeEgg);

    expect(scaleIngredientAmount(ingredient, 1)).toEqual({
      unit: ingredient.unit,
      quantity: ingredient.quantity,
      resolvedGrams: ingredient.resolved_grams,
      portion: ingredient.snapshot.portion,
    });
  });

  it("should not change the ingredient it is given", () => {
    const ingredient = ingredientIn("portion", 6, largeEgg);
    const before = structuredClone(ingredient);

    scaleIngredientAmount(ingredient, 1.5);

    expect(ingredient).toEqual(before);
  });

  it("should keep a factor from 3 to 4 servings within float error of the exact answer", () => {
    const scaled = scaleIngredientAmount(ingredientIn("g", 300), scaleFactor(4, 3));

    expect(scaled.quantity).toBeCloseTo(400, 9);
  });
});

describe("scaleYield", () => {
  it("should give 1,650 g for a cooked weight of 1,100 g at 4 to 6 servings", () => {
    expect(scaleYield(1100, scaleFactor(6, 4))).toBe(1650);
  });

  it("should give the original back at factor 1", () => {
    expect(scaleYield(1100, 1)).toBe(1100);
  });

  it("should be null when the recipe has no cooked weight", () => {
    expect(scaleYield(null, 1.5)).toBeNull();
  });
});
