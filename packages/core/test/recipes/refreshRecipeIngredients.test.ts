import { describe, expect, it } from "vitest";

import { SPOON_PORTIONS } from "../../src/nutrition";
import {
  buildRecipeIngredient,
  computeRecipe,
  recipeIngredientSchema,
  refreshRecipeIngredients,
} from "../../src/recipes";
import { buildChickenAndRiceRecipe, buildFood, buildFoodPortion } from "../../src/testing";

import type { RecipeIngredient, RefreshableFoods } from "../../src/recipes";
import type { Food, FoodPortion } from "../../src/schemas";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const noPortions: readonly FoodPortion[] = [];

const liveFoods = (...foods: readonly Food[]): RefreshableFoods =>
  new Map(foods.map((food) => [food.id, { food, portions: noPortions }]));

const recipe = buildChickenAndRiceRecipe();
const { chicken, rice, oil } = recipe.foods;
const unchangedFoods = liveFoods(chicken, rice, oil);
const recipeOf = <Ingredient extends RecipeIngredient>(ingredients: readonly Ingredient[]) => ({
  servings: recipe.servings,
  yieldGrams: recipe.yieldGrams,
  ingredients,
});

describe("refreshRecipeIngredients", () => {
  describe("when an ingredient froze the density of its food's serving label", () => {
    const ketchup = buildFood({ id: "00000000-0000-4000-8000-0000000000f2", name: "Ketchup" });
    const servingOf = (label: string, grams: number) => [
      buildFoodPortion({ food_id: ketchup.id, label, grams, is_default: true }),
    ];
    const ingredient = buildRecipeIngredient(ketchup, {
      quantity: 30,
      unit: "g",
      foodPortions: servingOf("1 tbsp (15 g)", 15),
    });
    const refreshWith = (portions: readonly FoodPortion[]) =>
      refreshRecipeIngredients({
        ...recipeOf([ingredient]),
        foods: new Map([[ketchup.id, { food: ketchup, portions }]]),
      });

    it("should say nothing changed while the serving is the same", () => {
      expect(ingredient.snapshot.density).toBe(1);
      expect(refreshWith(servingOf("1 tbsp (15 g)", 15)).hasChanges).toBe(false);
    });

    it("should refresh the density once the serving has changed", () => {
      const result = refreshWith(servingOf("1 tbsp (20 g)", 20));

      expect(result.hasChanges).toBe(true);
      expect(result.ingredients[0]?.snapshot.density).toBeCloseTo(20 / 15, 10);
    });
  });

  describe("when no food has changed", () => {
    const awkward = buildFood({
      id: "00000000-0000-4000-8000-0000000000f1",
      name: "Awkward",
      kcal: 123.456789,
      protein_g: 22.333333,
      fat_g: 0.1 + 0.2,
    });
    const ingredients = [
      ...recipe.ingredients,
      buildRecipeIngredient(awkward, { quantity: 333.333333, unit: "g" }),
    ];
    const result = refreshRecipeIngredients({
      ...recipeOf(ingredients),
      foods: liveFoods(chicken, rice, oil, awkward),
    });

    it("should say nothing changed", () => {
      expect(result.hasChanges).toBe(false);
      expect(result.changes.every((change) => !change.changed)).toBe(true);
    });

    it("should return every ingredient exactly as it was, not rebuilt", () => {
      expect(result.ingredients).toStrictEqual(ingredients);
      result.ingredients.forEach((ingredient, index) => {
        expect(ingredient).toBe(ingredients[index]);
      });
    });

    it("should have a before equal to the after", () => {
      expect(result.after).toStrictEqual(result.before);
    });

    it("should list no per 100 value as different", () => {
      expect(result.changes.flatMap((change) => change.per100Changes)).toStrictEqual([]);
    });
  });

  describe("when one custom food was edited", () => {
    const editedChicken = buildFood({
      ...chicken,
      kcal: 110,
      protein_g: 25,
      fat_g: 1,
    });
    const result = refreshRecipeIngredients({
      ...recipeOf(recipe.ingredients),
      foods: liveFoods(editedChicken, rice, oil),
    });
    const [chickenRow, riceRow, oilRow] = result.ingredients;
    const [chickenChange, riceChange, oilChange] = result.changes;

    it("should say there are changes", () => {
      expect(result.hasChanges).toBe(true);
    });

    it("should rebuild only that ingredient, keeping its quantity and unit", () => {
      expect(chickenRow?.snapshot.per100.kcal).toBe(110);
      expect(chickenRow?.quantity).toBe(500);
      expect(chickenRow?.unit).toBe("g");
      expect(chickenRow?.resolved_grams).toBe(500);
      expect(riceRow).toBe(recipe.ingredients[1]);
      expect(oilRow).toBe(recipe.ingredients[2]);
    });

    it("should give a row that still satisfies the ingredient rules", () => {
      expect(recipeIngredientSchema.safeParse(chickenRow).success).toBe(true);
    });

    it("should change the calories per serving by exactly the ingredient's change divided by the servings", () => {
      const change = ((110 - 120) * 500) / 100;

      expect(result.perServing.kcal.before).toBeCloseTo(374.2, 9);
      expect(result.perServing.kcal.after).toBeCloseTo(374.2 + change / 4, 9);
      expect(result.perServing.kcal.after).toBeCloseTo(361.7, 9);
    });

    it("should change the protein and the fat per serving, and leave the carbs", () => {
      expect(result.perServing.protein_g.before).toBeCloseTo(31.625, 9);
      expect(result.perServing.protein_g.after).toBeCloseTo(31.625 + (2.5 * 5) / 4, 9);
      expect(result.perServing.fat_g.before).toBeCloseTo((500 * 0.02 + 2 + 20) / 4, 9);
      expect(result.perServing.fat_g.after).toBeCloseTo((500 * 0.01 + 2 + 20) / 4, 9);
      expect(result.perServing.carbs_g.after).toBe(result.perServing.carbs_g.before);
    });

    it("should have an after equal to computing the new ingredients", () => {
      expect(result.after).toStrictEqual(
        computeRecipe({ servings: 4, yieldGrams: null, ingredients: result.ingredients }),
      );
      expect(result.before).toStrictEqual(computeRecipe(recipeOf(recipe.ingredients)));
    });

    it("should describe the changed ingredient", () => {
      expect(chickenChange).toStrictEqual({
        position: 0,
        foodId: chicken.id,
        changed: true,
        foodGone: false,
        name: { before: "Chicken breast", after: "Chicken breast" },
        basis: { before: "per_100g", after: "per_100g" },
        per100Changes: [
          { nutrient: "kcal", before: 120, after: 110 },
          { nutrient: "protein_g", before: 22.5, after: 25 },
          { nutrient: "fat_g", before: 2, after: 1 },
        ],
        kcal: { before: 600, after: 550 },
        amount: {
          before: { quantity: 500, unit: "g", portionLabel: null },
          after: { quantity: 500, unit: "g", portionLabel: null },
        },
        portionFellBack: false,
      });
    });

    it("should describe the ingredients that stay as they are, in the recipe's order", () => {
      expect(riceChange).toMatchObject({
        position: 1,
        foodId: rice.id,
        changed: false,
        foodGone: false,
        per100Changes: [],
        kcal: { before: 720, after: 720 },
      });
      expect(oilChange).toMatchObject({ position: 2, foodId: oil.id, changed: false });
    });
  });

  it("should report a new name", () => {
    const result = refreshRecipeIngredients({
      ...recipeOf(recipe.ingredients),
      foods: liveFoods({ ...chicken, name: "Chicken breast fillets" }, rice, oil),
    });

    expect(result.changes[0]).toMatchObject({
      changed: true,
      name: { before: "Chicken breast", after: "Chicken breast fillets" },
      per100Changes: [],
    });
  });

  it("should report a basis that flipped, so the numbers are not read across bases", () => {
    const result = refreshRecipeIngredients({
      ...recipeOf(recipe.ingredients),
      foods: liveFoods({ ...chicken, basis: "per_100ml", density_g_per_ml: 1 }, rice, oil),
    });

    expect(result.changes[0]).toMatchObject({
      changed: true,
      basis: { before: "per_100g", after: "per_100ml" },
    });
    expect(result.changes[1]?.basis).toStrictEqual({ before: "per_100g", after: "per_100g" });
  });

  it("should report a value that was added or dropped as a change from or to null", () => {
    const salted = buildFood({ ...chicken, salt_g: 0.4 });
    const result = refreshRecipeIngredients({
      ...recipeOf(recipe.ingredients),
      foods: liveFoods(salted, rice, oil),
    });

    expect(result.changes[0]?.per100Changes).toStrictEqual([
      { nutrient: "salt_g", before: null, after: 0.4 },
    ]);
  });

  describe("density", () => {
    const sesameOil = buildFood({
      id: "00000000-0000-4000-8000-0000000000e1",
      name: "Sesame oil",
      density_g_per_ml: 0.92,
      kcal: 884,
      fat_g: 100,
    });
    const spoonful = buildRecipeIngredient(sesameOil, {
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
    });
    const refresh = (food: Food) =>
      refreshRecipeIngredients({
        servings: 1,
        yieldGrams: null,
        ingredients: [spoonful],
        foods: liveFoods(food),
      });

    it("should change the grams and so the recipe when the density of a spoon measure changes", () => {
      const result = refresh({ ...sesameOil, density_g_per_ml: 0.5 });

      expect(spoonful.resolved_grams).toBeCloseTo(27.6, 9);
      expect(result.ingredients[0]?.resolved_grams).toBeCloseTo(15, 9);
      expect(result.ingredients[0]?.snapshot.density).toBe(0.5);
      expect(result.ingredients[0]?.portion_id).toBeNull();
      expect(result.after.totalGrams).toBeCloseTo(15, 9);
      expect(result.after.total.kcal).not.toBe(result.before.total.kcal);
      expect(result.hasChanges).toBe(true);
    });

    it("should change nothing when the density is the same", () => {
      const result = refresh({ ...sesameOil });

      expect(result.hasChanges).toBe(false);
      expect(result.ingredients[0]).toBe(spoonful);
    });

    it("should count a density only when the food has its own, for a snapshot with none", () => {
      const plain = buildFood({ ...sesameOil, density_g_per_ml: null });
      const frozenWithNone = buildRecipeIngredient(plain, { quantity: 30, unit: "ml" });
      const refreshPlain = (food: Food) =>
        refreshRecipeIngredients({
          servings: 1,
          yieldGrams: null,
          ingredients: [frozenWithNone],
          foods: liveFoods(food),
        });

      expect(frozenWithNone.snapshot.density).toBeNull();
      expect(refreshPlain(plain).hasChanges).toBe(false);
      expect(refreshPlain({ ...plain, density_g_per_ml: 0.8 }).hasChanges).toBe(true);
    });
  });

  describe("a portion", () => {
    const bread = buildFood({
      id: "00000000-0000-4000-8000-0000000000b1",
      name: "Bread",
      kcal: 250,
    });
    const slice = buildFoodPortion({
      id: "00000000-0000-4000-8000-0000000000c1",
      food_id: bread.id,
      label: "Slice",
      grams: 40,
    });
    const twoSlices = buildRecipeIngredient(bread, {
      quantity: 2,
      unit: "portion",
      portion: slice,
    });
    const refresh = (portions: readonly FoodPortion[]) =>
      refreshRecipeIngredients({
        servings: 2,
        yieldGrams: null,
        ingredients: [twoSlices],
        foods: new Map([[bread.id, { food: { ...bread, kcal: 300 }, portions }]]),
      });

    it("should be found again on the live food, at its live size", () => {
      const result = refresh([{ ...slice, grams: 50 }]);

      expect(result.ingredients[0]).toMatchObject({
        quantity: 2,
        unit: "portion",
        portion_id: slice.id,
        resolved_grams: 100,
      });
      expect(result.changes[0]?.portionFellBack).toBe(false);
      expect(result.changes[0]?.amount.after).toStrictEqual({
        quantity: 2,
        unit: "portion",
        portionLabel: "Slice",
      });
    });

    it("should fall back to a direct amount in grams when it is no longer on the food", () => {
      const result = refresh([]);

      expect(result.ingredients[0]).toMatchObject({
        quantity: 80,
        unit: "g",
        portion_id: null,
        resolved_grams: 80,
      });
      expect(result.ingredients[0]?.snapshot.portion).toBeNull();
      expect(result.changes[0]?.portionFellBack).toBe(true);
      expect(result.changes[0]?.amount).toStrictEqual({
        before: { quantity: 2, unit: "portion", portionLabel: "Slice" },
        after: { quantity: 80, unit: "g", portionLabel: null },
      });
      expect(result.after.totalGrams).toBe(80);
    });
  });

  describe("a change to a portion alone", () => {
    const bread = buildFood({
      id: "00000000-0000-4000-8000-0000000000b2",
      name: "Bread",
      kcal: 250,
    });
    const slice = buildFoodPortion({
      id: "00000000-0000-4000-8000-0000000000c2",
      food_id: bread.id,
      label: "Slice",
      grams: 40,
    });
    const twoSlices = buildRecipeIngredient(bread, {
      quantity: 2,
      unit: "portion",
      portion: slice,
    });

    it.each([
      ["resized", [{ ...slice, grams: 50 }]],
      ["removed", noPortions],
    ])("should not count a portion that was %s as a change", (_name, portions) => {
      const result = refreshRecipeIngredients({
        servings: 2,
        yieldGrams: null,
        ingredients: [twoSlices],
        foods: new Map([[bread.id, { food: bread, portions }]]),
      });

      expect(result.hasChanges).toBe(false);
      expect(result.ingredients[0]).toBe(twoSlices);
      expect(result.changes[0]).toMatchObject({ changed: false, portionFellBack: false });
    });
  });

  describe("a food that is gone", () => {
    const editedChicken = buildFood({ ...chicken, kcal: 110 });

    it.each([
      ["missing from the foods", liveFoods(editedChicken, rice)],
      [
        "soft deleted",
        liveFoods(editedChicken, rice, {
          ...oil,
          kcal: 1,
          deleted_at: "2026-10-16T10:00:00+00:00",
        }),
      ],
    ])("should keep the ingredient as it was and say so when its food is %s", (_name, foods) => {
      const result = refreshRecipeIngredients({ ...recipeOf(recipe.ingredients), foods });

      expect(result.ingredients[2]).toBe(recipe.ingredients[2]);
      expect(result.changes[2]).toMatchObject({
        position: 2,
        foodId: oil.id,
        changed: false,
        foodGone: true,
        name: { before: "Olive oil", after: "Olive oil" },
        per100Changes: [],
        kcal: { before: 176.8, after: 176.8 },
        portionFellBack: false,
      });
      expect(result.changes[0]?.foodGone).toBe(false);
    });

    it("should still compute the recipe, with the other changes applied", () => {
      const result = refreshRecipeIngredients({
        ...recipeOf(recipe.ingredients),
        foods: liveFoods(editedChicken, rice),
      });

      expect(result.hasChanges).toBe(true);
      expect(result.after.total.kcal).toBeCloseTo(1496.8 - 50, 9);
    });

    it("should not call a recipe changed when the only news is a deleted food", () => {
      const result = refreshRecipeIngredients({
        ...recipeOf(recipe.ingredients),
        foods: liveFoods(chicken, rice),
      });

      expect(result.hasChanges).toBe(false);
      expect(result.changes[2]?.foodGone).toBe(true);
    });
  });

  describe("bad input", () => {
    it("should refuse a food filed under the wrong id, without quoting anything", () => {
      const wrong = new Map([[chicken.id, { food: rice, portions: noPortions }]]);
      const attempt = () =>
        refreshRecipeIngredients({
          ...recipeOf(recipe.ingredients),
          foods: new Map([...liveFoods(rice, oil), ...wrong]),
        });

      expect(attempt).toThrow(RangeError);
      expect(attempt).toThrow(/^[^\d]*$/u);
      expect(attempt).not.toThrow(/Chicken|Dry rice/u);
    });

    it("should refuse a look-alike food with another id, which would otherwise look unchanged", () => {
      const lookAlike = buildFood({ ...chicken, id: "00000000-0000-4000-8000-0000000000a9" });
      const attempt = () =>
        refreshRecipeIngredients({
          ...recipeOf(recipe.ingredients),
          foods: new Map([
            ...liveFoods(rice, oil),
            [chicken.id, { food: lookAlike, portions: noPortions }],
          ]),
        });

      expect(attempt).toThrow(RangeError);
      expect(attempt).toThrow(/^[^\d]*$/u);
      expect(attempt).not.toThrow(/Chicken/u);
    });

    it("should refuse servings that are not above 0, as computeRecipe does", () => {
      expect(() =>
        refreshRecipeIngredients({
          ...recipeOf(recipe.ingredients),
          servings: 0,
          foods: unchangedFoods,
        }),
      ).toThrow(RangeError);
    });
  });

  it("should keep the extra columns of a stored ingredient, such as its position", () => {
    const stored = recipe.ingredients.map((ingredient, position) => ({ ...ingredient, position }));
    const result = refreshRecipeIngredients({
      ...recipeOf(stored),
      foods: liveFoods({ ...chicken, kcal: 110 }, rice, oil),
    });

    expect(result.ingredients.map((ingredient) => ingredient.position)).toStrictEqual([0, 1, 2]);
  });

  it("should use the yield when it computes the recipe", () => {
    const result = refreshRecipeIngredients({
      ...recipeOf(recipe.ingredients),
      yieldGrams: 1100,
      foods: liveFoods({ ...chicken, kcal: 110 }, rice, oil),
    });

    expect(result.before.effectiveGrams).toBe(1100);
    expect(result.after.effectiveGrams).toBe(1100);
  });
});
