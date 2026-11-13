import { describe, expect, it } from "vitest";

import { CHICKEN_AND_RICE, PORRIDGE_BOWL } from "./seedRecipes";
import { adjustmentTarget, fitRecipeToTargets } from "../../../src/recipes";

import type { FitIngredient, FitInput } from "../../../src/recipes";

const baseline = (recipe: Pick<FitInput, "ingredients" | "servings">) =>
  fitRecipeToTargets({ ...recipe, target: {} }).perServing;

describe("fitRecipeToTargets golden cases from the eval user's recipes", () => {
  it("starts Eval chicken and rice at 518 kcal and 49.3 g protein a serving", () => {
    const { kcal, protein_g } = baseline(CHICKEN_AND_RICE);
    expect(kcal).toBeCloseTo(518.0, 0);
    expect(protein_g).toBeCloseTo(49.28, 2);
  });

  it("starts Eval porridge bowl at 389 kcal and 13.3 g protein a serving", () => {
    const { kcal, protein_g } = baseline(PORRIDGE_BOWL);
    expect(kcal).toBeCloseTo(389.4, 1);
    expect(protein_g).toBeCloseTo(13.33, 2);
  });

  it("gets Eval chicken and rice to +30 g protein by scaling, with the calories held", () => {
    const original = baseline(CHICKEN_AND_RICE);
    const target = adjustmentTarget(original, { nutrient: "protein_g", mode: "add", value: 30 });
    const result = fitRecipeToTargets({ ...CHICKEN_AND_RICE, target });

    expect(result.status).toBe("within");
    expect(result.misses).toEqual([]);
    expect(result.perServing.protein_g).toBeGreaterThanOrEqual((original.protein_g ?? 0) + 30 - 5);
    expect(Math.abs((result.perServing.kcal ?? 0) - (original.kcal ?? 0))).toBeLessThanOrEqual(
      (original.kcal ?? 0) * 0.05,
    );
    for (const [at, { grams }] of result.ingredients.entries()) {
      const proposed = CHICKEN_AND_RICE.ingredients[at]?.grams ?? 0;
      expect(grams).toBeGreaterThanOrEqual(proposed / 2);
      expect(grams).toBeLessThanOrEqual(proposed * 2);
    }
  });

  it("reports Eval porridge bowl as unreachable for +30 g protein, naming the protein miss", () => {
    const original = baseline(PORRIDGE_BOWL);
    const target = adjustmentTarget(original, { nutrient: "protein_g", mode: "add", value: 30 });
    const result = fitRecipeToTargets({ ...PORRIDGE_BOWL, target });

    expect(result.status).toBe("unreachable");
    const protein = result.misses.find((miss) => miss.nutrient === "protein_g");
    expect(protein?.target).toBeCloseTo((original.protein_g ?? 0) + 30, 6);
    expect(protein?.achieved).toBeLessThan((original.protein_g ?? 0) + 30 - 5);
    expect(protein?.limitedBy.length).toBeGreaterThan(0);
  });
});

describe("fitRecipeToTargets behaviour", () => {
  it("returns a recipe that is already within tolerance unchanged", () => {
    const original = baseline(CHICKEN_AND_RICE);
    const result = fitRecipeToTargets({
      ...CHICKEN_AND_RICE,
      target: { kcal: (original.kcal ?? 0) + 10, protein_g: (original.protein_g ?? 0) - 3 },
    });
    expect(result.status).toBe("within");
    expect(result.ingredients).toEqual(
      CHICKEN_AND_RICE.ingredients.map(({ foodId, grams }) => ({ foodId, grams })),
    );
  });

  it("never moves a locked ingredient", () => {
    const ingredients = CHICKEN_AND_RICE.ingredients.map((ingredient) => ({
      ...ingredient,
      locked: ingredient.foodId === "chicken",
    }));
    const result = fitRecipeToTargets({
      servings: 2,
      ingredients,
      target: { kcal: 600, protein_g: 55 },
    });
    expect(result.ingredients[0]).toEqual({ foodId: "chicken", grams: 260 });
  });

  it("is unreachable with no adjustable ingredient carrying the nutrient", () => {
    const result = fitRecipeToTargets({
      servings: 2,
      ingredients: CHICKEN_AND_RICE.ingredients.map((ingredient) => ({
        ...ingredient,
        locked: true,
      })),
      target: { protein_g: 90 },
    });
    expect(result.status).toBe("unreachable");
    expect(result.misses).toEqual([
      expect.objectContaining({
        nutrient: "protein_g",
        reason: "no_adjustable_ingredient",
        limitedBy: [],
      }),
    ]);
  });

  it("holds an ingredient's own minimum and maximum", () => {
    const ingredients = CHICKEN_AND_RICE.ingredients.map((ingredient) =>
      ingredient.foodId === "chicken"
        ? { ...ingredient, minGrams: 250, maxGrams: 280 }
        : ingredient,
    );
    const result = fitRecipeToTargets({ servings: 2, ingredients, target: { protein_g: 90 } });
    const chicken = result.ingredients[0]?.grams ?? 0;
    expect(chicken).toBeGreaterThanOrEqual(250);
    expect(chicken).toBeLessThanOrEqual(280);
  });

  it("judges carbs and fat only when they are named", () => {
    const result = fitRecipeToTargets({ ...CHICKEN_AND_RICE, target: { kcal: 518, carbs_g: 20 } });
    expect(
      result.misses.every((miss) => miss.nutrient === "carbs_g" || miss.nutrient === "kcal"),
    ).toBe(true);
    expect(result.status === "within" || result.misses.length > 0).toBe(true);
  });

  it("reports the figures computeRecipe gives for the grams it returns", () => {
    const result = fitRecipeToTargets({
      ...CHICKEN_AND_RICE,
      target: { protein_g: 80, kcal: 518 },
    });
    const again = fitRecipeToTargets({
      servings: 2,
      ingredients: CHICKEN_AND_RICE.ingredients.map((ingredient, at) => ({
        ...ingredient,
        grams: result.ingredients[at]?.grams ?? 0,
      })),
      target: {},
    });
    expect(again.perServing).toEqual(result.perServing);
  });

  it("refuses servings that are not above 0", () => {
    expect(() => fitRecipeToTargets({ ...CHICKEN_AND_RICE, servings: 0, target: {} })).toThrow(
      RangeError,
    );
  });

  it("refuses an ingredient with no amount", () => {
    const [first, ...rest] = CHICKEN_AND_RICE.ingredients;
    const ingredients = first === undefined ? rest : [{ ...first, grams: 0 }, ...rest];
    expect(() => fitRecipeToTargets({ servings: 2, ingredients, target: {} })).toThrow(RangeError);
  });
});

const lockedOne = (per100: Partial<FitIngredient["per100"]>): FitIngredient => ({
  foodId: "only",
  per100: { kcal: 100, protein_g: 10, fat_g: 10, carbs_g: 10, fibre_g: 0, ...per100 },
  grams: 100,
  locked: true,
});

const unlockedOne = (per100: Partial<FitIngredient["per100"]>, grams = 100): FitIngredient => ({
  ...lockedOne(per100),
  grams,
  locked: false,
});

describe("fitRecipeToTargets tolerance", () => {
  it("judges each nutrient by its own tolerance field", () => {
    const tolerance = { kcalPercent: 3, proteinGrams: 2, macroGrams: 7 };
    const within = fitRecipeToTargets({
      servings: 1,
      ingredients: [lockedOne({})],
      target: { kcal: 103, protein_g: 12, carbs_g: 17, fat_g: 3 },
      tolerance,
    });
    expect(within.status).toBe("within");

    const tooFar = fitRecipeToTargets({
      servings: 1,
      ingredients: [lockedOne({})],
      target: { kcal: 96, protein_g: 12.5, carbs_g: 17.5, fat_g: 2.5 },
      tolerance,
    });
    expect(tooFar.misses.map((miss) => miss.nutrient)).toEqual([
      "kcal",
      "protein_g",
      "carbs_g",
      "fat_g",
    ]);
  });

  it.each([
    ["not a number", { kcalPercent: Number.NaN, proteinGrams: 5, macroGrams: 5 }],
    ["infinite", { kcalPercent: 5, proteinGrams: Number.POSITIVE_INFINITY, macroGrams: 5 }],
    ["negative", { kcalPercent: 5, proteinGrams: 5, macroGrams: -1 }],
  ])("refuses a tolerance field that is %s", (_, tolerance) => {
    expect(() => fitRecipeToTargets({ ...CHICKEN_AND_RICE, target: {}, tolerance })).toThrow(
      RangeError,
    );
  });
});

describe("fitRecipeToTargets band floor", () => {
  it("never takes a 6 g ingredient below 5 g", () => {
    const result = fitRecipeToTargets({
      servings: 1,
      ingredients: [unlockedOne({ kcal: 899, protein_g: 0, fat_g: 99.9, carbs_g: 0 }, 6)],
      target: { kcal: 10 },
    });
    expect(result.status).toBe("unreachable");
    expect(result.ingredients[0]?.grams).toBe(5);
  });
});

describe("fitRecipeToTargets with no data", () => {
  it("reports a named nutrient no ingredient has data for as no_data, never within", () => {
    const result = fitRecipeToTargets({
      servings: 1,
      ingredients: [unlockedOne({ protein_g: null })],
      target: { protein_g: 0 },
    });
    expect(result.status).toBe("unreachable");
    expect(result.misses).toEqual([
      { nutrient: "protein_g", target: 0, achieved: null, reason: "no_data", limitedBy: [] },
    ]);
  });

  it("reports no_data when the ingredients are locked as well", () => {
    const result = fitRecipeToTargets({
      servings: 1,
      ingredients: [lockedOne({ protein_g: null })],
      target: { protein_g: 10 },
    });
    expect(result.misses[0]?.reason).toBe("no_data");
  });

  it("does not report no_data when a locked ingredient has the figure and an unlocked one lacks it", () => {
    const result = fitRecipeToTargets({
      servings: 1,
      ingredients: [
        { ...lockedOne({}), foodId: "locked" },
        { ...unlockedOne({ protein_g: null }), foodId: "free" },
      ],
      target: { protein_g: 50 },
    });
    expect(result.status).toBe("unreachable");
    expect(result.misses[0]?.reason).not.toBe("no_data");
  });

  it("still fits the nutrients that have data while reporting the one that has none", () => {
    const result = fitRecipeToTargets({
      servings: 1,
      ingredients: [unlockedOne({ fat_g: null }, 100)],
      target: { kcal: 100, fat_g: 10 },
    });
    expect(result.misses.map((miss) => miss.nutrient)).toEqual(["fat_g"]);
  });
});
