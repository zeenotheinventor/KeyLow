import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary";
import { SPOON_PORTIONS, densityForLogging } from "../../src/nutrition";
import { buildRecipeIngredient, recipeIngredientSchema } from "../../src/recipes";
import { buildFood, buildFoodPortion } from "../../src/testing";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const oil = buildFood({
  id: "00000000-0000-4000-8000-0000000000e1",
  name: "Test oil",
  density_g_per_ml: 0.92,
  kcal: 884,
  protein_g: 0,
  fat_g: 100,
  carbs_g: 0,
});
const slice = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000c1",
  food_id: oil.id,
  label: "Slice",
  grams: 35,
});

describe("buildRecipeIngredient", () => {
  describe("in grams", () => {
    const ingredient = buildRecipeIngredient(oil, { quantity: 20, unit: "g" });

    it("should keep the amount in the columns", () => {
      expect(ingredient).toMatchObject({
        food_id: oil.id,
        quantity: 20,
        unit: "g",
        resolved_grams: 20,
      });
    });

    it("should have no portion and no portion link", () => {
      expect(ingredient.snapshot.portion).toBeNull();
      expect(ingredient.portion_id).toBeNull();
    });

    it("should be a snapshot of the food, as buildFoodSnapshot freezes it", () => {
      expect(ingredient.snapshot).toEqual(buildFoodSnapshot(oil, { quantity: 20, unit: "g" }));
    });

    it("should be a valid ingredient row", () => {
      expect(recipeIngredientSchema.safeParse(ingredient).success).toBe(true);
    });

    it("should not carry a position, which the database assigns", () => {
      expect(ingredient).not.toHaveProperty("position");
    });
  });

  describe("in a natural portion", () => {
    const ingredient = buildRecipeIngredient(oil, { quantity: 2, unit: "portion", portion: slice });

    it("should freeze the portion label and grams in the snapshot", () => {
      expect(ingredient.snapshot.portion).toEqual({ label: "Slice", grams: 35 });
    });

    it("should link the portion row", () => {
      expect(ingredient.portion_id).toBe(slice.id);
    });

    it("should resolve the grams from the portion", () => {
      expect(ingredient.resolved_grams).toBe(70);
      expect(ingredient.quantity).toBe(2);
      expect(ingredient.unit).toBe("portion");
    });

    it("should be a valid ingredient row", () => {
      expect(recipeIngredientSchema.safeParse(ingredient).success).toBe(true);
    });
  });

  describe("in a spoon", () => {
    const ingredient = buildRecipeIngredient(oil, {
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
    });

    it("should freeze the spoon as a label and millilitres in the snapshot", () => {
      expect(ingredient.snapshot.portion).toEqual({ label: "1 tbsp", ml: 15 });
    });

    it("should have no portion link, because a spoon is not a table row", () => {
      expect(ingredient.portion_id).toBeNull();
    });

    it("should resolve the grams through the density frozen in the snapshot", () => {
      expect(ingredient.snapshot.density).toBe(0.92);
      expect(ingredient.resolved_grams).toBeCloseTo(2 * 15 * 0.92, 10);
    });

    it("should be a valid ingredient row", () => {
      expect(recipeIngredientSchema.safeParse(ingredient).success).toBe(true);
    });
  });

  describe("freezing", () => {
    it("should freeze the estimated density of a food that has none of its own", () => {
      const olive = buildFood({
        source: "cofid",
        source_ref: null,
        food_group: "OC",
        density_g_per_ml: null,
      });
      const expectedDensity = densityForLogging(olive);

      const ingredient = buildRecipeIngredient(olive, {
        quantity: 1,
        unit: "portion",
        portion: tablespoon,
      });

      expect(expectedDensity).not.toBeNull();
      expect(ingredient.snapshot.density).toBe(expectedDensity);
    });

    it("should not move when the food is edited afterwards", () => {
      const ingredient = buildRecipeIngredient(oil, {
        quantity: 1,
        unit: "portion",
        portion: tablespoon,
      });
      const before = structuredClone(ingredient);

      const edited = { ...oil, density_g_per_ml: 0.5, kcal: 1 };
      const rebuilt = buildRecipeIngredient(edited, {
        quantity: 1,
        unit: "portion",
        portion: tablespoon,
      });

      expect(ingredient).toEqual(before);
      expect(rebuilt.resolved_grams).not.toBe(ingredient.resolved_grams);
    });
  });

  describe("when the amount is wrong", () => {
    it("should throw a RangeError for the portion unit without a portion", () => {
      expect(() => buildRecipeIngredient(oil, { quantity: 1, unit: "portion" })).toThrow(
        RangeError,
      );
    });

    it.each([
      { quantity: -4321 },
      { quantity: Number.NaN },
      { quantity: Number.POSITIVE_INFINITY },
    ])(
      "should throw a RangeError that states the rule for a quantity of $quantity",
      ({ quantity }) => {
        const attempt = () => buildRecipeIngredient(oil, { quantity, unit: "g" });

        expect(attempt).toThrow(RangeError);
        expect(attempt).toThrow("The quantity must be a finite number of at least 0");
        expect(attempt).not.toThrow(/4321|NaN|Infinity/);
      },
    );
  });
});
