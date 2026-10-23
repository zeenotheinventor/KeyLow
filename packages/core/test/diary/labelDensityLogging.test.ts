import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { foodChangedSinceLogged } from "../../src/diary/foodChangedSinceLogged";
import { pickerChoices } from "../../src/diary/pickerChoices";
import { previewAmount } from "../../src/diary/previewAmount";
import { recomputeEntry } from "../../src/diary/recomputeEntry";
import { refreshSnapshotFromFood } from "../../src/diary/refreshSnapshotFromFood";
import { snapshotAsFood } from "../../src/diary/snapshotAmount";
import { normaliseOffProduct } from "../../src/foods/off";
import { canMeasureByVolume, densityForLogging } from "../../src/nutrition/volume";
import { buildRecipeIngredient } from "../../src/recipes/buildRecipeIngredient";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { AmountPortion } from "../../src/diary/previewAmount";
import type { FoodPortion } from "../../src/schemas/food";

const when = { loggedAt: "2026-10-22T12:30:00+01:00", localDate: "2026-10-22" };

// A branded sauce as Open Food Facts gives it, with a serving of "1 tbsp (15 g)".
const sauceProduct = (servingSize: string, servingQuantity: number) => ({
  code: "5000000010011",
  product_name: "Tomato ketchup",
  serving_size: servingSize,
  serving_quantity: servingQuantity,
  nutriments: { "energy-kcal_100g": 100, proteins_100g: 1, fat_100g: 0, carbohydrates_100g: 25 },
});

const cachedSauce = (servingSize: string, servingQuantity: number) => {
  const result = normaliseOffProduct(sauceProduct(servingSize, servingQuantity));
  if (!result.ok) {
    throw new Error("The product must normalise");
  }
  const food = buildFood({ ...result.food, source: "off", source_ref: result.food.barcode });
  const portions: FoodPortion[] = result.portions.map((portion, position) =>
    buildFoodPortion({
      id: `portion-${position}`,
      label: portion.label,
      grams: portion.grams,
      ml: portion.ml,
      is_default: portion.isDefault,
      position,
    }),
  );
  return { food, portions };
};

const ketchup = cachedSauce("1 tbsp (15 g)", 15);

describe("a branded food whose serving is in spoons", () => {
  it("should offer ml, tsp and tbsp, where it offered none without the serving", () => {
    const withServing = pickerChoices(ketchup.food, ketchup.portions);
    const withoutServing = pickerChoices(ketchup.food, []);

    expect(withServing.options.map(({ label }) => label)).toEqual([
      "1 tbsp (15 g)",
      "g",
      "ml",
      "1 tsp",
      "1 tbsp",
    ]);
    expect(withoutServing.options.map(({ label }) => label)).toEqual(["g"]);
  });

  it("should be measured by volume only while its portions say so", () => {
    expect(canMeasureByVolume(ketchup.food, ketchup.portions)).toBe(true);
    expect(canMeasureByVolume(ketchup.food, [])).toBe(false);
  });

  it("should resolve 1 tbsp to the 15 g of the label, and 1 tsp to a third of it", () => {
    const logged = (portion: AmountPortion) =>
      buildLogEntry({
        food: ketchup.food,
        quantity: 1,
        unit: "portion",
        portion,
        foodPortions: ketchup.portions,
        ...when,
      });
    const { portions } = pickerChoices(ketchup.food, ketchup.portions);
    const tablespoon = portions.find(({ id }) => id === "spoon-tbsp");
    const teaspoon = portions.find(({ id }) => id === "spoon-tsp");
    if (tablespoon === undefined || teaspoon === undefined) {
      throw new Error("The spoons must be offered");
    }

    expect(logged(tablespoon).resolved_grams).toBeCloseTo(15, 10);
    expect(logged(teaspoon).resolved_grams).toBeCloseTo(5, 10);
  });

  it("should give the hero and the entry the same values and the weight of the label", () => {
    const { portions } = pickerChoices(ketchup.food, ketchup.portions);

    const { amount, hero } = previewAmount(ketchup.food, portions, "spoon-tbsp", "2");
    if (amount === null || hero.values === null) {
      throw new Error("The amount must be valid");
    }
    const entry = buildLogEntry({
      food: ketchup.food,
      quantity: amount.quantity,
      unit: amount.unit,
      ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
      foodPortions: ketchup.portions,
      ...when,
    });

    expect(hero.caption).toBe("For 2 tbsp (30 ml, 30 g)");
    expect(hero.values.kcal).toBe(entry.nutrients.kcal);
    expect(entry.resolved_grams).toBeCloseTo(30, 10);
  });

  it("should convert millilitres by the label's density", () => {
    const dense = cachedSauce("2 tsp (13 g)", 13);

    const entry = buildLogEntry({
      food: dense.food,
      quantity: 100,
      unit: "ml",
      foodPortions: dense.portions,
      ...when,
    });

    expect(entry.resolved_grams).toBeCloseTo(130, 10);
  });

  it("should take the grams of a volume-only label from the portion's grams", () => {
    const spoonOnly = cachedSauce("1 tbsp", 12);

    expect(densityForLogging(spoonOnly.food, spoonOnly.portions)).toBeCloseTo(0.8, 10);
  });

  it("should freeze the density into the entry, so editing the serving later does not change it", () => {
    const entry = buildLogEntry({
      food: ketchup.food,
      quantity: 1,
      unit: "g",
      foodPortions: ketchup.portions,
      ...when,
    });

    expect(entry.snapshot.density).toBe(1);

    const editedPortions = [
      buildFoodPortion({ id: "portion-0", label: "1 tbsp (20 g)", grams: 20 }),
    ];
    expect(densityForLogging(ketchup.food, editedPortions)).not.toBe(entry.snapshot.density);
    expect(entry.snapshot.density).toBe(1);
  });

  it("should keep an entry that froze the label's density from reading as changed", () => {
    const entry = buildLogEntry({
      food: ketchup.food,
      quantity: 1,
      unit: "g",
      foodPortions: ketchup.portions,
      ...when,
    });

    expect(foodChangedSinceLogged(ketchup.food, entry.snapshot, ketchup.portions)).toBe(false);
  });

  it("should flag an entry once the serving it froze has changed, and refresh it to the new one", () => {
    const entry = buildLogEntry({
      food: ketchup.food,
      quantity: 1,
      unit: "g",
      foodPortions: ketchup.portions,
      ...when,
    });
    const editedPortions = [
      buildFoodPortion({ id: "portion-0", label: "1 tbsp (20 g)", grams: 20, is_default: true }),
    ];

    expect(foodChangedSinceLogged(ketchup.food, entry.snapshot, editedPortions)).toBe(true);
    expect(
      refreshSnapshotFromFood(entry.snapshot, null, ketchup.food, editedPortions).snapshot.density,
    ).toBeCloseTo(20 / 15, 10);
  });

  it("should not flag an old entry that has no density because the food now has a serving label", () => {
    const old = buildLogEntry({ food: ketchup.food, quantity: 1, unit: "g", ...when });

    expect(old.snapshot.density).toBeNull();
    expect(foodChangedSinceLogged(ketchup.food, old.snapshot, ketchup.portions)).toBe(false);
  });

  it("should freeze the density into a recipe ingredient", () => {
    const ingredient = buildRecipeIngredient(ketchup.food, {
      quantity: 1,
      unit: "g",
      foodPortions: ketchup.portions,
    });

    expect(ingredient.snapshot.density).toBe(1);
  });

  it("should keep a density of its own over the label's", () => {
    const own = buildFood({ ...ketchup.food, density_g_per_ml: 1.2 });

    expect(densityForLogging(own, ketchup.portions)).toBe(1.2);
  });

  it("should freeze the label's density for a drink measured per 100 ml, which the grams then use", () => {
    const drink = cachedSauce("100 ml (103 g)", 100);

    expect(drink.food.basis).toBe("per_100ml");
    expect(densityForLogging(drink.food, drink.portions)).toBeCloseTo(1.03, 10);
  });
});

describe("editing an entry that froze no density, on a food that now has a serving label", () => {
  // A drink logged before the label density existed: its snapshot froze none, and its food now has a
  // "100 ml (103 g)" serving. Saving uses only the snapshot, so the hero must not read the label either.
  const drink = cachedSauce("100 ml (103 g)", 100);
  const old = buildLogEntry({ food: drink.food, quantity: 100, unit: "ml", ...when });
  const servedPortions = [
    ...drink.portions.map(({ id, label, grams, ml }) => ({ id, label, grams, ml })),
  ];

  it("should show the values that saving stores", () => {
    expect(old.snapshot.density).toBeNull();

    const { amount, hero } = previewAmount(
      snapshotAsFood(old.snapshot),
      servedPortions,
      "g",
      "100",
    );
    if (amount === null || hero.values === null) {
      throw new Error("The amount must be valid");
    }
    const stored = recomputeEntry(old, { quantity: 100, unit: "g" });

    expect(hero.values.kcal).toBe(stored.nutrients.kcal);
    expect(hero.values.kcal).toBe(drink.food.kcal);
  });

  it("should still read the label for a food row, which a new log freezes", () => {
    const { hero } = previewAmount(drink.food, servedPortions, "g", "100");

    expect(hero.values?.kcal).toBeCloseTo((drink.food.kcal ?? 0) / 1.03, 6);
  });
});
