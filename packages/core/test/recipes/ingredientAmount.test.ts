import { describe, expect, it } from "vitest";

import { SNAPSHOT_PORTION_ID } from "../../src/diary";
import { buildRecipeIngredient, frozenFoodOf, newIngredient, withAmount } from "../../src/recipes";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { ChosenAmount } from "../../src/diary";

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

const ketchup = buildFood({ name: "Ketchup", source: "off", source_ref: "5000000010011" });
const ketchupTablespoon = buildFoodPortion({
  food_id: ketchup.id,
  label: "1 tbsp (15 g)",
  grams: 15,
});

describe("newIngredient", () => {
  it("should freeze the food's values into the ingredient for the amount", () => {
    const ingredient = newIngredient(onions, { unit: "portion", quantity: 2, portion: medium }, [
      medium,
    ]);

    expect(ingredient).toEqual(
      buildRecipeIngredient(onions, { quantity: 2, unit: "portion", portion: medium }),
    );
    expect(ingredient.resolved_grams).toBe(220);
    expect(ingredient.portion_id).toBe(medium.id);
  });

  it("should freeze the density of the food's serving label into the ingredient", () => {
    const ingredient = newIngredient(ketchup, { unit: "g", quantity: 30 }, [ketchupTablespoon]);

    expect(ingredient.snapshot.density).toBe(1);
    expect(newIngredient(ketchup, { unit: "g", quantity: 30 }, []).snapshot.density).toBeNull();
  });
});

describe("withAmount", () => {
  it("should give the ingredient back as it is when the amount is as it was", () => {
    const amount: ChosenAmount = { unit: "portion", quantity: 1, portion: mediumAsFrozen };

    expect(withAmount(oneMedium, amount)).toBe(oneMedium);
  });

  it("should change the amount and keep the values the ingredient was added with", () => {
    const original = buildRecipeIngredient(onions, { quantity: 100, unit: "g" });

    const edited = withAmount(original, { unit: "g", quantity: 250 });

    expect(edited.quantity).toBe(250);
    expect(edited.resolved_grams).toBe(250);
    expect(edited.snapshot.per100).toEqual(original.snapshot.per100);
    expect(edited.food_id).toBe(original.food_id);
  });

  it("should keep the link of the portion it was added with on that portion's own chip", () => {
    const edited = withAmount(oneMedium, {
      unit: "portion",
      quantity: 3,
      portion: mediumAsFrozen,
    });

    expect(edited.portion_id).toBe(medium.id);
    expect(edited.resolved_grams).toBe(330);
  });

  it("should link another of the food's portions by its own id", () => {
    const edited = withAmount(oneMedium, { unit: "portion", quantity: 1, portion: large });

    expect(edited.portion_id).toBe(large.id);
    expect(edited.snapshot.portion).toEqual({ label: "1 large", grams: 160 });
  });

  it("should treat another unit at the same count as a change", () => {
    const edited = withAmount(oneMedium, { unit: "g", quantity: 1 });

    expect(edited).not.toBe(oneMedium);
    expect(edited.unit).toBe("g");
    expect(edited.portion_id).toBeNull();
  });

  it("should give a spoon no link", () => {
    const oil = buildFood({ name: "Oil, olive", density_g_per_ml: 0.92, kcal: 899 });
    const original = buildRecipeIngredient(oil, { quantity: 10, unit: "g" });

    const edited = withAmount(original, { unit: "portion", quantity: 1, portion: tablespoon });

    expect(edited.portion_id).toBeNull();
    expect(edited.resolved_grams).toBeCloseTo(13.8);
  });

  it("should keep the density the snapshot froze when the amount changes, with no portions to read one from", () => {
    const original = newIngredient(ketchup, { unit: "g", quantity: 30 }, [ketchupTablespoon]);

    const edited = withAmount(original, { unit: "g", quantity: 60 });

    expect(original.snapshot.density).toBe(1);
    expect(edited.snapshot.density).toBe(1);
    expect(edited.resolved_grams).toBe(60);
  });

  describe("on an ingredient added with newIngredient", () => {
    it("should change the amount and keep the values the ingredient was added with", () => {
      const original = newIngredient(onions, { unit: "g", quantity: 100 }, [medium]);

      const edited = withAmount(original, { unit: "g", quantity: 250 });

      expect(edited.quantity).toBe(250);
      expect(edited.resolved_grams).toBe(250);
      expect(edited.snapshot.per100).toEqual(original.snapshot.per100);
      expect(edited.food_id).toBe(original.food_id);
    });

    it("should keep the link of the portion the ingredient was added with on the snapshot's own chip", () => {
      const original = newIngredient(onions, { unit: "portion", quantity: 1, portion: medium }, [
        medium,
      ]);

      const edited = withAmount(original, {
        unit: "portion",
        quantity: 3,
        portion: { id: "snapshot-portion", label: "1 medium", grams: 110, ml: null },
      });

      expect(edited.portion_id).toBe(medium.id);
      expect(edited.resolved_grams).toBe(330);
    });

    it("should link another of the food's portions by its id", () => {
      const original = newIngredient(onions, { unit: "portion", quantity: 1, portion: medium }, [
        medium,
      ]);

      const edited = withAmount(original, { unit: "portion", quantity: 1, portion: large });

      expect(edited.portion_id).toBe(large.id);
      expect(edited.snapshot.portion).toEqual({ label: "1 large", grams: 160 });
    });

    it("should give a spoon no link", () => {
      const oil = buildFood({ name: "Oil, olive", density_g_per_ml: 0.92, kcal: 899 });
      const original = newIngredient(oil, { unit: "g", quantity: 10 }, []);

      const edited = withAmount(original, { unit: "portion", quantity: 1, portion: tablespoon });

      expect(edited.portion_id).toBeNull();
      expect(edited.resolved_grams).toBeCloseTo(13.8);
    });
  });
});

describe("frozenFoodOf", () => {
  it("should be the food as the ingredient froze it, whatever the food is now", () => {
    const food = frozenFoodOf(oneMedium);

    expect(food).toMatchObject({ name: "Onions, raw", kcal: 35, protein_g: 1, deleted_at: null });
    expect(food.id).toBe(oneMedium.snapshot.ref);
  });
});
