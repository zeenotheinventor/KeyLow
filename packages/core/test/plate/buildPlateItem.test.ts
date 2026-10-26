import { describe, expect, it } from "vitest";

import { banana, chickenAndRice, greekYoghurt, semiSkimmedMilk } from "./sample";
import { recipeAmountStart } from "../../src/diary";
import {
  plateItemOfHit,
  plateItemOfPickedFood,
  plateItemOfRecent,
  plateItemOfRecipe,
} from "../../src/plate";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { FoodSnapshot } from "../../src/diary";

describe("plateItemOfHit", () => {
  it("should be 1 of the default portion, with the values for one", () => {
    const item = plateItemOfHit("row-1", greekYoghurt);

    expect(item).toMatchObject({
      kind: "food",
      key: "row-1",
      foodId: greekYoghurt.id,
      name: "Greek yoghurt 0% fat",
      quantityText: "1",
      quantity: 1,
      unit: {
        kind: "portion",
        portionId: greekYoghurt.default_portion_id,
        label: "1 pot",
        size: { amount: 170, unit: "g" },
      },
    });
    expect(item.perUnit.kcal).toBeCloseTo(97, 6);
    expect(item.perUnit.protein_g).toBeCloseTo(17.3, 6);
    expect(item.perUnit.carbs_g).toBeCloseTo(6.5, 6);
    expect(item.perUnit.fat_g).toBeCloseTo(0.3, 6);
  });

  it("should be 100 ml of a drink with no portion, with the values for one millilitre", () => {
    const item = plateItemOfHit("row-2", semiSkimmedMilk);

    expect(item).toMatchObject({ quantityText: "100", quantity: 100, unit: { kind: "ml" } });
    expect(item.perUnit.kcal).toBeCloseTo(0.46, 8);
    expect(item.perUnit.protein_g).toBeCloseTo(0.035, 8);
  });

  it("should be 100 g of a food with no portion", () => {
    const item = plateItemOfHit("row-3", {
      ...banana,
      default_portion_id: null,
      default_portion_label: null,
      default_portion_grams: null,
    });

    expect(item).toMatchObject({ quantity: 100, unit: { kind: "g" } });
    expect(item.perUnit.kcal).toBeCloseTo(0.95, 8);
  });

  it("should size a portion measured in millilitres in millilitres", () => {
    const item = plateItemOfHit("row-4", {
      ...semiSkimmedMilk,
      default_portion_id: "glass-id",
      default_portion_label: "1 glass",
      default_portion_ml: 250,
    });

    expect(item.unit).toEqual({
      kind: "portion",
      portionId: "glass-id",
      label: "1 glass",
      size: { amount: 250, unit: "ml" },
    });
    expect(item.perUnit.kcal).toBeCloseTo(115, 6);
  });

  it("should count a value the food does not give as 0", () => {
    const item = plateItemOfHit("row-5", { ...banana, protein_g: null, kcal: null });

    expect(item.perUnit).toEqual({ kcal: 0, protein_g: 0, carbs_g: 20.3, fat_g: 0.1 });
  });
});

describe("plateItemOfRecent", () => {
  const snapshot: FoodSnapshot = {
    v: 1,
    kind: "food",
    ref: banana.id,
    name: "Banana",
    basis: "per_100g",
    per100: { kcal: 95, protein_g: 1.2, fat_g: 0.1, carbs_g: 20.3, fibre_g: null },
    quantity: 2,
    unit: "portion",
    portion: { label: "1 medium", grams: 100 },
    density: null,
    resolvedGrams: 200,
    engineVersion: 1,
  };

  it("should be the amount last logged, with a portion carrying its stored size", () => {
    const item = plateItemOfRecent("recent-1", {
      foodId: banana.id,
      portionId: "portion-id",
      snapshot,
    });

    expect(item).toMatchObject({
      kind: "food",
      foodId: banana.id,
      name: "Banana",
      quantityText: "2",
      quantity: 2,
      unit: {
        kind: "portion",
        portionId: "portion-id",
        label: "1 medium",
        size: { amount: 100, unit: "g" },
      },
      perUnit: { kcal: 95, protein_g: 1.2, carbs_g: 20.3, fat_g: 0.1 },
    });
  });

  it("should keep a replaced portion's label and size with no link", () => {
    const item = plateItemOfRecent("recent-2", { foodId: banana.id, portionId: null, snapshot });

    expect(item.unit).toMatchObject({ kind: "portion", portionId: null, label: "1 medium" });
  });

  it("should take a portion entry with no portion on its snapshot as the grams it came to", () => {
    const item = plateItemOfRecent("recent-6", {
      foodId: banana.id,
      portionId: null,
      snapshot: { ...snapshot, portion: null, quantity: 2, resolvedGrams: 230 },
    });

    expect(item).toMatchObject({ quantity: 230, quantityText: "230", unit: { kind: "g" } });
    expect(item.perUnit.kcal).toBeCloseTo(0.95, 8);
  });

  it("should keep grams and millilitres as they were logged", () => {
    const grams = plateItemOfRecent("recent-3", {
      foodId: banana.id,
      portionId: null,
      snapshot: { ...snapshot, unit: "g", portion: null, quantity: 150, resolvedGrams: 150 },
    });

    expect(grams).toMatchObject({ quantity: 150, quantityText: "150", unit: { kind: "g" } });
    expect(grams.perUnit.kcal).toBeCloseTo(0.95, 8);

    const millilitres = plateItemOfRecent("recent-4", {
      foodId: banana.id,
      portionId: null,
      snapshot: {
        ...snapshot,
        basis: "per_100ml",
        unit: "ml",
        portion: null,
        quantity: 200,
        resolvedGrams: 200,
      },
    });

    expect(millilitres).toMatchObject({ quantity: 200, unit: { kind: "ml" } });
    expect(millilitres.perUnit.kcal).toBeCloseTo(0.95, 8);
  });

  it("should give ounces as grams, to a tenth, as the picker does", () => {
    const item = plateItemOfRecent("recent-5", {
      foodId: banana.id,
      portionId: null,
      snapshot: { ...snapshot, unit: "oz", portion: null, quantity: 2, resolvedGrams: 56.699 },
    });

    expect(item).toMatchObject({ quantity: 56.7, quantityText: "56.7", unit: { kind: "g" } });
    expect(item.perUnit.kcal).toBeCloseTo(0.95, 8);
  });
});

describe("plateItemOfRecipe", () => {
  it("should be one serving of a recipe row, with the values for one serving", () => {
    const item = plateItemOfRecipe({ key: "recipe-1", recipe: chickenAndRice });

    expect(item).toMatchObject({
      kind: "recipe",
      key: "recipe-1",
      recipe: chickenAndRice,
      quantityText: "1",
      quantity: 1,
      unit: "serving",
    });
    expect(item.perUnit.kcal).toBeCloseTo(374.2, 6);
    expect(item.perUnit.protein_g).toBeCloseTo(31.625, 6);
    expect(item.perUnit.carbs_g).toBeCloseTo(42.55, 6);
    expect(item.perUnit.fat_g).toBeCloseTo(8.125, 6);
  });

  it("should take the amount the picker chose, in servings or grams", () => {
    const servings = plateItemOfRecipe({
      key: "recipe-2",
      recipe: chickenAndRice,
      amount: { quantity: 1.5, unit: "serving" },
    });

    expect(servings).toMatchObject({ quantity: 1.5, quantityText: "1.5", unit: "serving" });

    const grams = plateItemOfRecipe({
      key: "recipe-3",
      recipe: chickenAndRice,
      amount: { quantity: 275, unit: "g" },
    });

    expect(grams).toMatchObject({ quantity: 275, unit: "g" });
    expect(grams.perUnit.kcal).toBeCloseTo(374.2 / 275, 8);
  });

  it("should start at the amount the recipe picker opens on", () => {
    expect(plateItemOfRecipe({ key: "recipe-4", recipe: chickenAndRice })).toMatchObject({
      quantity: recipeAmountStart().quantity,
      unit: recipeAmountStart().unit,
    });
  });
});

describe("plateItemOfPickedFood", () => {
  const medium = buildFoodPortion({ id: "medium-id", label: "1 medium", grams: 100 });
  const food = buildFood({
    id: banana.id,
    name: "Banana",
    kcal: 95,
    protein_g: 1.2,
    carbs_g: 20.3,
    fat_g: 0.1,
  });

  it("should be the portion and the count the picker chose", () => {
    const item = plateItemOfPickedFood({
      key: "picked-1",
      food,
      portions: [medium],
      amount: { unit: "portion", quantity: 2, portion: medium },
    });

    expect(item).toMatchObject({
      kind: "food",
      key: "picked-1",
      foodId: banana.id,
      name: "Banana",
      quantityText: "2",
      quantity: 2,
      unit: {
        kind: "portion",
        portionId: "medium-id",
        label: "1 medium",
        size: { amount: 100, unit: "g" },
      },
    });
    expect(item.perUnit.kcal).toBeCloseTo(95, 6);
  });

  it("should be grams of the food", () => {
    const item = plateItemOfPickedFood({
      key: "picked-2",
      food,
      portions: [medium],
      amount: { unit: "g", quantity: 150 },
    });

    expect(item).toMatchObject({ quantity: 150, unit: { kind: "g" } });
    expect(item.perUnit.kcal).toBeCloseTo(0.95, 8);
  });

  it("should work out millilitres of a food measured by weight from its density", () => {
    const oil = buildFood({ id: "oil-id", name: "Oil", kcal: 900, density_g_per_ml: 0.9 });
    const item = plateItemOfPickedFood({
      key: "picked-3",
      food: oil,
      portions: [],
      amount: { unit: "ml", quantity: 10 },
    });

    expect(item.unit).toEqual({ kind: "ml" });
    expect(item.perUnit.kcal).toBeCloseTo(8.1, 6);
  });

  it("should size a spoon in millilitres", () => {
    const item = plateItemOfPickedFood({
      key: "picked-4",
      food: buildFood({ id: "oil-id", name: "Oil", kcal: 900, density_g_per_ml: 0.9 }),
      portions: [{ id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 }],
      amount: {
        unit: "portion",
        quantity: 2,
        portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
      },
    });

    expect(item.unit).toEqual({
      kind: "portion",
      portionId: "spoon-tbsp",
      label: "1 tbsp",
      size: { amount: 15, unit: "ml" },
    });
    expect(item.perUnit.kcal).toBeCloseTo(121.5, 6);
  });
});
