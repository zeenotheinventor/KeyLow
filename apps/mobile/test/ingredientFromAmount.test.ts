import { SNAPSHOT_PORTION_ID } from "@keylow/core/diary";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";

import { frozenFoodOf, ingredientWithAmount } from "../lib/ingredientFromAmount";

import type { ChosenAmount } from "@keylow/core/diary";

const onions = buildFood({
  name: "Onions, raw",
  kcal: 35,
  protein_g: 1,
  carbs_g: 8,
  fat_g: 0.1,
});
const medium = buildFoodPortion({
  id: "44444444-4444-4444-8444-444444444444",
  food_id: onions.id,
  label: "1 medium",
  grams: 110,
});
const large = buildFoodPortion({
  id: "55555555-5555-4555-8555-555555555555",
  food_id: onions.id,
  label: "1 large",
  grams: 160,
});
const tablespoon = { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 };

// Added as one medium onion, so it holds the link to the medium portion.
const oneMedium = buildRecipeIngredient(onions, { quantity: 1, unit: "portion", portion: medium });
const mediumAsFrozen = { id: SNAPSHOT_PORTION_ID, label: "1 medium", grams: 110, ml: null };

describe("ingredientWithAmount", () => {
  it("should give the ingredient back as it is when the amount is as it was", () => {
    const amount: ChosenAmount = { unit: "portion", quantity: 1, portion: mediumAsFrozen };

    expect(ingredientWithAmount(oneMedium, amount)).toBe(oneMedium);
  });

  it("should change the amount and keep the values the ingredient was added with", () => {
    const original = buildRecipeIngredient(onions, { quantity: 100, unit: "g" });

    const edited = ingredientWithAmount(original, { unit: "g", quantity: 250 });

    expect(edited.quantity).toBe(250);
    expect(edited.resolved_grams).toBe(250);
    expect(edited.snapshot.per100).toEqual(original.snapshot.per100);
    expect(edited.food_id).toBe(original.food_id);
  });

  it("should keep the link of the portion it was added with on that portion's own chip", () => {
    const edited = ingredientWithAmount(oneMedium, {
      unit: "portion",
      quantity: 3,
      portion: mediumAsFrozen,
    });

    expect(edited.portion_id).toBe(medium.id);
    expect(edited.resolved_grams).toBe(330);
  });

  it("should link another of the food's portions by its own id", () => {
    const edited = ingredientWithAmount(oneMedium, {
      unit: "portion",
      quantity: 1,
      portion: large,
    });

    expect(edited.portion_id).toBe(large.id);
    expect(edited.snapshot.portion).toEqual({ label: "1 large", grams: 160 });
  });

  it("should treat another unit at the same count as a change", () => {
    const edited = ingredientWithAmount(oneMedium, { unit: "g", quantity: 1 });

    expect(edited).not.toBe(oneMedium);
    expect(edited.unit).toBe("g");
    expect(edited.portion_id).toBeNull();
  });

  it("should give a spoon no link", () => {
    const oil = buildFood({ name: "Oil, olive", density_g_per_ml: 0.92, kcal: 899 });
    const original = buildRecipeIngredient(oil, { quantity: 10, unit: "g" });

    const edited = ingredientWithAmount(original, {
      unit: "portion",
      quantity: 1,
      portion: tablespoon,
    });

    expect(edited.portion_id).toBeNull();
    expect(edited.resolved_grams).toBeCloseTo(13.8);
  });
});

describe("frozenFoodOf", () => {
  it("should be the food as the ingredient froze it, whatever the food is now", () => {
    const food = frozenFoodOf(oneMedium);

    expect(food).toMatchObject({ name: "Onions, raw", kcal: 35, protein_g: 1, deleted_at: null });
    expect(food.id).toBe(oneMedium.snapshot.ref);
  });
});
