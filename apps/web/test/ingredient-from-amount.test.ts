import { buildRecipeIngredient } from "@keylow/core/recipes";
import { describe, expect, it } from "vitest";

import { makeFood, makePortion } from "./foods/support";

import { editedIngredient, newIngredient } from "@/lib/ingredientFromAmount";

const food = makeFood({ name: "Onions, raw", kcal: 35, protein_g: 1, carbs_g: 8, fat_g: 0.1 });
const medium = makePortion({
  id: "44444444-4444-4444-8444-444444444444",
  food_id: food.id,
  label: "1 medium",
  grams: 110,
});

describe("newIngredient", () => {
  it("should freeze the food's values into the ingredient for the amount", () => {
    const ingredient = newIngredient(food, { unit: "portion", quantity: 2, portion: medium }, [
      medium,
    ]);

    expect(ingredient).toEqual(
      buildRecipeIngredient(food, { quantity: 2, unit: "portion", portion: medium }),
    );
    expect(ingredient.resolved_grams).toBe(220);
    expect(ingredient.portion_id).toBe(medium.id);
  });
});

describe("newIngredient with a serving label", () => {
  it("should freeze the density of the food's serving into the ingredient", () => {
    const sauce = makeFood({ name: "Ketchup", source: "off", source_ref: "5000000010011" });
    const tablespoon = makePortion({ food_id: sauce.id, label: "1 tbsp (15 g)", grams: 15 });

    const ingredient = newIngredient(sauce, { unit: "g", quantity: 30 }, [tablespoon]);

    expect(ingredient.snapshot.density).toBe(1);
    expect(newIngredient(sauce, { unit: "g", quantity: 30 }, []).snapshot.density).toBeNull();
  });
});

describe("editedIngredient", () => {
  it("should change the amount and keep the values the ingredient was added with", () => {
    const original = newIngredient(food, { unit: "g", quantity: 100 }, [medium]);

    const edited = editedIngredient(original, { unit: "g", quantity: 250 });

    expect(edited.quantity).toBe(250);
    expect(edited.resolved_grams).toBe(250);
    expect(edited.snapshot.per100).toEqual(original.snapshot.per100);
    expect(edited.food_id).toBe(original.food_id);
  });

  it("should keep the link of the portion the ingredient was added with on the snapshot's own chip", () => {
    const original = newIngredient(food, { unit: "portion", quantity: 1, portion: medium }, [
      medium,
    ]);
    const ownPortion = {
      id: "snapshot-portion",
      label: "1 medium",
      grams: 110,
      ml: null,
    };

    const edited = editedIngredient(original, {
      unit: "portion",
      quantity: 3,
      portion: ownPortion,
    });

    expect(edited.portion_id).toBe(medium.id);
    expect(edited.resolved_grams).toBe(330);
  });

  it("should link another of the food's portions by its id", () => {
    const original = newIngredient(food, { unit: "portion", quantity: 1, portion: medium }, [
      medium,
    ]);
    const large = makePortion({
      id: "55555555-5555-4555-8555-555555555555",
      food_id: food.id,
      label: "1 large",
      grams: 160,
    });

    const edited = editedIngredient(original, { unit: "portion", quantity: 1, portion: large });

    expect(edited.portion_id).toBe(large.id);
    expect(edited.snapshot.portion).toEqual({ label: "1 large", grams: 160 });
  });

  it("should give a spoon no link", () => {
    const oil = makeFood({ name: "Oil, olive", density_g_per_ml: 0.92, kcal: 899 });
    const original = newIngredient(oil, { unit: "g", quantity: 10 }, []);

    const edited = editedIngredient(original, {
      unit: "portion",
      quantity: 1,
      portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
    });

    expect(edited.portion_id).toBeNull();
    expect(edited.resolved_grams).toBeCloseTo(13.8);
  });
});
