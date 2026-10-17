import { describe, expect, it } from "vitest";

import { SPOON_PORTIONS } from "../../src/nutrition";
import { buildRecipeIngredient, recipeViewOf } from "../../src/recipes";
import { buildChickenAndRiceRecipe, buildFood, buildFoodPortion } from "../../src/testing";

import type { StoredRecipe } from "../../src/recipes";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const chickenAndRice = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

const storedChickenAndRice = (overrides: Partial<StoredRecipe> = {}): StoredRecipe => ({
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  instructions: ["Boil the rice", "Fry the chicken"],
  ingredients: chickenAndRice.ingredients,
  ...overrides,
});

const largeEgg = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b1",
  label: "1 large",
  grams: 50,
});
const mediumOnion = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b2",
  label: "1 medium",
  grams: 110,
});
const frittataIngredients = [
  buildRecipeIngredient(
    buildFood({ id: "00000000-0000-4000-8000-0000000000c1", name: "Eggs, chicken, whole, raw" }),
    { quantity: 6, unit: "portion", portion: largeEgg },
  ),
  buildRecipeIngredient(
    buildFood({
      id: "00000000-0000-4000-8000-0000000000c2",
      name: "Milk, semi-skimmed, pasteurised, average",
      density_g_per_ml: 1.03,
    }),
    { quantity: 100, unit: "ml" },
  ),
  buildRecipeIngredient(
    buildFood({
      id: "00000000-0000-4000-8000-0000000000c3",
      name: "Oil, olive",
      density_g_per_ml: 0.92,
    }),
    { quantity: 1, unit: "portion", portion: tablespoon },
  ),
  buildRecipeIngredient(
    buildFood({ id: "00000000-0000-4000-8000-0000000000c4", name: "Onions, raw" }),
    { quantity: 1, unit: "portion", portion: mediumOnion },
  ),
  buildRecipeIngredient(
    buildFood({ id: "00000000-0000-4000-8000-0000000000c5", name: "Spinach, baby, raw" }),
    { quantity: 100, unit: "g" },
  ),
  buildRecipeIngredient(
    buildFood({ id: "00000000-0000-4000-8000-0000000000c6", name: "Cheese, Cheddar, English" }),
    { quantity: 60, unit: "g" },
  ),
];
const storedFrittata = (overrides: Partial<StoredRecipe> = {}): StoredRecipe => ({
  name: "Spinach and cheddar frittata",
  servings: 4,
  yield_grams: 620,
  instructions: ["Heat the oven to 200 °C (fan 180 °C)."],
  ingredients: frittataIngredients,
  ...overrides,
});

const captionsOf = (recipe: StoredRecipe, chosenServings: number | null): string[] =>
  recipeViewOf(recipe, chosenServings).ingredients.map((ingredient) => ingredient.caption);

describe("recipeViewOf the chicken and rice at 6 servings", () => {
  const view = recipeViewOf(storedChickenAndRice(), 6);

  it("should scale the amounts by 1.5 and keep the recipe's order and the food names", () => {
    expect(view.ingredients).toEqual([
      {
        name: "Chicken breast",
        caption: "750 g",
        accessibleName: "Chicken breast, 750 g",
      },
      { name: "Dry rice", caption: "300 g", accessibleName: "Dry rice, 300 g" },
      { name: "Olive oil", caption: "30 g", accessibleName: "Olive oil, 30 g" },
    ]);
  });

  it("should write everything the view prints", () => {
    expect(view).toMatchObject({
      servings: 6,
      isScaled: true,
      valueText: "6 servings",
      yieldLine: "Makes 6 · 1,650 g cooked",
      ingredientsFor: "For 6 servings",
      stepsNote: "The steps are written for 4 servings.",
      resetLabel: "Back to 4 servings",
      announcement: "Ingredients for 6 servings, 1,650 grams cooked",
    });
  });
});

describe("recipeViewOf the chicken and rice at its own servings", () => {
  it.each([null, 4])("should not be scaled when the chosen servings are %s", (chosen) => {
    const view = recipeViewOf(storedChickenAndRice(), chosen);

    expect(view).toMatchObject({
      servings: 4,
      isScaled: false,
      valueText: "4 servings",
      yieldLine: "Makes 4 · 1,100 g cooked",
      ingredientsFor: "For 4 servings",
      stepsNote: null,
      resetLabel: null,
      announcement: "Ingredients for 4 servings, 1,100 grams cooked",
    });
    expect(view.ingredients.map((ingredient) => ingredient.caption)).toEqual([
      "500 g",
      "200 g",
      "20 g",
    ]);
  });
});

describe("recipeViewOf the frittata", () => {
  it("should read as the recipe does at its own servings", () => {
    expect(captionsOf(storedFrittata(), null)).toEqual([
      "6 × 1 large (300 g)",
      "100 ml",
      "1 tbsp (15 ml)",
      "1 medium (110 g)",
      "100 g",
      "60 g",
    ]);
  });

  it("should halve at 2 servings", () => {
    const view = recipeViewOf(storedFrittata(), 2);

    expect(view.ingredients.map((ingredient) => ingredient.caption)).toEqual([
      "3 × 1 large (150 g)",
      "50 ml",
      "0.5 tbsp (7.5 ml)",
      "0.5 × 1 medium (55 g)",
      "50 g",
      "30 g",
    ]);
    expect(view.yieldLine).toBe("Makes 2 · 310 g cooked");
  });

  it("should quarter at 1 serving, with two-decimal counts", () => {
    const view = recipeViewOf(storedFrittata(), 1);

    expect(view.ingredients.map((ingredient) => ingredient.caption)).toEqual([
      "1.5 × 1 large (75 g)",
      "25 ml",
      "0.25 tbsp (3.8 ml)",
      "0.25 × 1 medium (28 g)",
      "25 g",
      "15 g",
    ]);
    expect(view).toMatchObject({
      yieldLine: "Makes 1 · 155 g cooked",
      valueText: "1 serving",
      ingredientsFor: "For 1 serving",
      resetLabel: "Back to 4 servings",
      announcement: "Ingredients for 1 serving, 155 grams cooked",
    });
  });

  it("should name an ingredient by its food and its amount as written", () => {
    expect(recipeViewOf(storedFrittata(), 2).ingredients[0]?.accessibleName).toBe(
      "Eggs, chicken, whole, raw, 3 × 1 large (150 g)",
    );
  });
});

describe("recipeViewOf the steps note", () => {
  it("should be null at any scale for a recipe with no steps", () => {
    for (const chosen of [null, 1, 4, 6, 1000]) {
      expect(recipeViewOf(storedChickenAndRice({ instructions: [] }), chosen).stepsNote).toBeNull();
    }
  });

  it("should be there once scaled and the recipe has steps", () => {
    expect(recipeViewOf(storedChickenAndRice(), 5).stepsNote).toBe(
      "The steps are written for 4 servings.",
    );
  });
});

describe("recipeViewOf a recipe with no cooked weight", () => {
  const view = recipeViewOf(storedChickenAndRice({ yield_grams: null }), 6);

  it("should say there is no cooked weight", () => {
    expect(view.yieldLine).toBe("Makes 6 · no cooked weight");
  });

  it("should announce the servings without grams", () => {
    expect(view.announcement).toBe("Ingredients for 6 servings");
  });
});

describe("recipeViewOf a recipe saved at 2.5 servings", () => {
  const recipe = storedChickenAndRice({ servings: 2.5, yield_grams: 700 });

  it("should start at the recipe's own and not be scaled", () => {
    expect(recipeViewOf(recipe, null)).toMatchObject({
      servings: 2.5,
      isScaled: false,
      valueText: "2.5 servings",
      resetLabel: null,
      yieldLine: "Makes 2.5 · 700 g cooked",
    });
  });

  it("should accept its own servings back as the chosen number", () => {
    expect(recipeViewOf(recipe, 2.5).isScaled).toBe(false);
  });

  it("should offer to go back to the fraction once scaled", () => {
    expect(recipeViewOf(recipe, 3)).toMatchObject({
      servings: 3,
      isScaled: true,
      resetLabel: "Back to 2.5 servings",
    });
  });
});

describe("recipeViewOf an amount that rounds to nothing", () => {
  // KEY-326 decision: no floor and no "less than" form. A count of 0.004 reads "0" and the grams in
  // brackets still say what it is; it is only reachable at 1 serving of a recipe saved for hundreds.
  it("should leave a count of 0.004 as it reads, with the grams in brackets", () => {
    const onion = buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c4", name: "Onions, raw" }),
      { quantity: 1, unit: "portion", portion: mediumOnion },
    );

    expect(captionsOf(storedFrittata({ servings: 250, ingredients: [onion] }), 1)).toEqual([
      "0 × 1 medium (0.4 g)",
    ]);
  });
});

describe("recipeViewOf the 12.5 and 13 difference", () => {
  // On purpose (brief 25's two-decimal rule): the view keeps the decimal that the diary's
  // describeLoggedAmount rounds away.
  it("should write a count of 10 or more with its decimal", () => {
    const eggs = buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c1", name: "Eggs, chicken, whole, raw" }),
      { quantity: 5, unit: "portion", portion: largeEgg },
    );

    expect(captionsOf(storedFrittata({ servings: 4, ingredients: [eggs] }), 10)).toEqual([
      "12.5 × 1 large (625 g)",
    ]);
  });
});

describe("recipeViewOf the chosen servings", () => {
  it("should throw for servings that are not whole and not the recipe's own", () => {
    expect(() => recipeViewOf(storedChickenAndRice(), 2.5)).toThrow(RangeError);
    expect(() => recipeViewOf(storedChickenAndRice(), 0)).toThrow(RangeError);
    expect(() => recipeViewOf(storedChickenAndRice(), 1001)).toThrow(RangeError);
  });

  it("should not change the recipe", () => {
    const recipe = storedChickenAndRice();
    const before = structuredClone(recipe);

    recipeViewOf(recipe, 6);

    expect(recipe).toEqual(before);
  });
});
