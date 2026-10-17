import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary";
import {
  MAX_INGREDIENT_RESOLVED_GRAMS,
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_NAME_LENGTH,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
  MAX_RECIPE_YIELD_GRAMS,
  recipeComputedSchema,
  recipeIngredientSchema,
  recipeSchema,
  storedRecipeIngredientSchema,
} from "../../src/recipes";
import { buildFood } from "../../src/testing";

const food = buildFood();
const snapshot = buildFoodSnapshot(food, { quantity: 150, unit: "g" });

const validRecipe = {
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  instructions: ["Brown the chicken.", "Add the rice and water."],
  is_archived: false,
};

const validIngredient = {
  food_id: food.id,
  quantity: 150,
  unit: "g",
  portion_id: null,
  resolved_grams: 150,
  snapshot,
};

const noNutrients = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
};

describe("the recipe bounds (ADR 0003, Amendment 8, The numbers)", () => {
  it.each([
    { name: "MAX_RECIPE_NAME_LENGTH", value: MAX_RECIPE_NAME_LENGTH, literal: 200 },
    { name: "MAX_RECIPE_SERVINGS", value: MAX_RECIPE_SERVINGS, literal: 1000 },
    { name: "MAX_RECIPE_YIELD_GRAMS", value: MAX_RECIPE_YIELD_GRAMS, literal: 100000 },
    { name: "MAX_RECIPE_STEPS", value: MAX_RECIPE_STEPS, literal: 50 },
    { name: "MAX_RECIPE_STEP_LENGTH", value: MAX_RECIPE_STEP_LENGTH, literal: 1000 },
    { name: "MAX_RECIPE_INGREDIENTS", value: MAX_RECIPE_INGREDIENTS, literal: 100 },
    {
      name: "MAX_INGREDIENT_RESOLVED_GRAMS",
      value: MAX_INGREDIENT_RESOLVED_GRAMS,
      literal: 100000,
    },
  ])("should keep $name at $literal", ({ value, literal }) => {
    expect(value).toBe(literal);
  });
});

describe("recipeSchema", () => {
  it("should accept a complete recipe", () => {
    expect(recipeSchema.parse(validRecipe)).toEqual(validRecipe);
  });

  it("should accept a recipe with no yield and no instructions", () => {
    const bare = { ...validRecipe, yield_grams: null, instructions: [] };

    expect(recipeSchema.parse(bare)).toEqual(bare);
  });

  describe("name", () => {
    it("should accept a name of exactly 200 characters", () => {
      expect(recipeSchema.safeParse({ ...validRecipe, name: "a".repeat(200) }).success).toBe(true);
    });

    it("should refuse a name of 201 characters", () => {
      expect(recipeSchema.safeParse({ ...validRecipe, name: "a".repeat(201) }).success).toBe(false);
    });

    it("should count characters and not UTF-16 units, as the database does", () => {
      const twoHundredEmoji = "\u{1F372}".repeat(200);

      expect(recipeSchema.safeParse({ ...validRecipe, name: twoHundredEmoji }).success).toBe(true);
      expect(recipeSchema.safeParse({ ...validRecipe, name: `${twoHundredEmoji}a` }).success).toBe(
        false,
      );
    });

    it.each([{ name: "" }, { name: "   " }, { name: "\t\n" }])(
      "should refuse a blank name ($name)",
      ({ name }) => {
        expect(recipeSchema.safeParse({ ...validRecipe, name }).success).toBe(false);
      },
    );
  });

  describe("servings", () => {
    it.each([{ servings: 0.5 }, { servings: 2.5 }, { servings: 1000 }])(
      "should accept $servings",
      ({ servings }) => {
        expect(recipeSchema.safeParse({ ...validRecipe, servings }).success).toBe(true);
      },
    );

    it.each([{ servings: 0 }, { servings: -1 }, { servings: 1000.5 }, { servings: Number.NaN }])(
      "should refuse $servings",
      ({ servings }) => {
        expect(recipeSchema.safeParse({ ...validRecipe, servings }).success).toBe(false);
      },
    );
  });

  describe("yield_grams", () => {
    it.each([{ yield_grams: null }, { yield_grams: 0.1 }, { yield_grams: 100000 }])(
      "should accept $yield_grams",
      ({ yield_grams }) => {
        expect(recipeSchema.safeParse({ ...validRecipe, yield_grams }).success).toBe(true);
      },
    );

    it.each([{ yield_grams: 0 }, { yield_grams: -5 }, { yield_grams: 100000.5 }])(
      "should refuse $yield_grams",
      ({ yield_grams }) => {
        expect(recipeSchema.safeParse({ ...validRecipe, yield_grams }).success).toBe(false);
      },
    );
  });

  describe("instructions", () => {
    it("should accept 50 steps", () => {
      const instructions = Array.from({ length: 50 }, (_, index) => `Step ${index + 1}`);

      expect(recipeSchema.safeParse({ ...validRecipe, instructions }).success).toBe(true);
    });

    it("should refuse 51 steps", () => {
      const instructions = Array.from({ length: 51 }, (_, index) => `Step ${index + 1}`);

      expect(recipeSchema.safeParse({ ...validRecipe, instructions }).success).toBe(false);
    });

    it("should accept a step of exactly 1000 characters and refuse 1001", () => {
      expect(
        recipeSchema.safeParse({ ...validRecipe, instructions: ["a".repeat(1000)] }).success,
      ).toBe(true);
      expect(
        recipeSchema.safeParse({ ...validRecipe, instructions: ["a".repeat(1001)] }).success,
      ).toBe(false);
    });

    it.each([{ step: "" }, { step: "  " }, { step: "\n\t" }])(
      "should refuse a blank step ($step)",
      ({ step }) => {
        expect(recipeSchema.safeParse({ ...validRecipe, instructions: [step] }).success).toBe(
          false,
        );
      },
    );

    it("should keep the order of the steps", () => {
      const instructions = ["Third", "First", "Second"];

      expect(recipeSchema.parse({ ...validRecipe, instructions }).instructions).toEqual(
        instructions,
      );
    });
  });

  it("should refuse a recipe without the archived flag", () => {
    expect(recipeSchema.safeParse({ ...validRecipe, is_archived: undefined }).success).toBe(false);
  });
});

describe("recipeIngredientSchema", () => {
  it("should accept an ingredient built from a snapshot", () => {
    expect(recipeIngredientSchema.safeParse(validIngredient).success).toBe(true);
  });

  it("should refuse a quantity of 0", () => {
    expect(recipeIngredientSchema.safeParse({ ...validIngredient, quantity: 0 }).success).toBe(
      false,
    );
  });

  it.each([{ grams: 0 }, { grams: -1 }, { grams: 100000.5 }])(
    "should refuse resolved grams of $grams even when the snapshot agrees",
    ({ grams }) => {
      // Forged so the quantity stays valid and only the resolved grams are out of bounds.
      expect(
        recipeIngredientSchema.safeParse({
          ...validIngredient,
          resolved_grams: grams,
          snapshot: { ...snapshot, resolvedGrams: grams },
        }).success,
      ).toBe(false);
    },
  );

  it("should accept resolved grams of exactly 100000", () => {
    const heaviest = buildFoodSnapshot(food, { quantity: 100000, unit: "g" });

    expect(
      recipeIngredientSchema.safeParse({
        ...validIngredient,
        quantity: 100000,
        resolved_grams: 100000,
        snapshot: heaviest,
      }).success,
    ).toBe(true);
  });

  it("should refuse a unit the quantity units do not have", () => {
    expect(recipeIngredientSchema.safeParse({ ...validIngredient, unit: "serving" }).success).toBe(
      false,
    );
  });

  it("should refuse a portion link on a unit that is not portion", () => {
    expect(
      recipeIngredientSchema.safeParse({
        ...validIngredient,
        portion_id: "00000000-0000-4000-8000-000000000002",
      }).success,
    ).toBe(false);
  });

  it("should accept a spoon ingredient, which has no portion link", () => {
    const spoon = buildFoodSnapshot(buildFood({ density_g_per_ml: 0.92 }), {
      quantity: 2,
      unit: "portion",
      portion: { label: "1 tbsp", grams: null, ml: 15 },
    });

    expect(
      recipeIngredientSchema.safeParse({
        ...validIngredient,
        quantity: 2,
        unit: "portion",
        portion_id: null,
        resolved_grams: spoon.resolvedGrams,
        snapshot: spoon,
      }).success,
    ).toBe(true);
  });

  it.each([
    { column: "food_id", value: "00000000-0000-4000-8000-0000000000ff" },
    { column: "quantity", value: 151 },
    { column: "unit", value: "oz" },
    { column: "resolved_grams", value: 149 },
  ])("should refuse a $column that disagrees with the snapshot", ({ column, value }) => {
    expect(recipeIngredientSchema.safeParse({ ...validIngredient, [column]: value }).success).toBe(
      false,
    );
  });
});

describe("storedRecipeIngredientSchema", () => {
  it("should accept an ingredient with its position", () => {
    expect(
      storedRecipeIngredientSchema.safeParse({ ...validIngredient, position: 0 }).success,
    ).toBe(true);
  });

  it.each([{ position: -1 }, { position: 1.5 }])(
    "should refuse the position $position",
    ({ position }) => {
      expect(storedRecipeIngredientSchema.safeParse({ ...validIngredient, position }).success).toBe(
        false,
      );
    },
  );

  it("should refuse an ingredient without a position", () => {
    expect(storedRecipeIngredientSchema.safeParse(validIngredient).success).toBe(false);
  });
});

describe("recipeComputedSchema", () => {
  const computed = {
    total: { ...noNutrients, kcal: 1496.8 },
    perServing: { ...noNutrients, kcal: 374.2 },
    per100g: { ...noNutrients, kcal: 136.0727 },
    totalGrams: 720,
    effectiveGrams: 1100,
    engineVersion: 1,
  };

  it("should accept the cache of a recipe", () => {
    expect(recipeComputedSchema.parse(computed)).toEqual(computed);
  });

  it("should accept the cache of a recipe with no ingredients", () => {
    const empty = {
      ...computed,
      total: noNutrients,
      perServing: noNutrients,
      per100g: noNutrients,
      totalGrams: 0,
      effectiveGrams: 0,
    };

    expect(recipeComputedSchema.safeParse(empty).success).toBe(true);
  });

  it("should refuse an engine version newer than the one that exists", () => {
    expect(recipeComputedSchema.safeParse({ ...computed, engineVersion: 2 }).success).toBe(false);
  });

  it("should refuse a cache without a key", () => {
    expect(recipeComputedSchema.safeParse({ ...computed, perServing: undefined }).success).toBe(
      false,
    );
  });
});
