import { describe, expect, it } from "vitest";

import { nutrientsSchema, strictNutrientsSchema } from "../../src/schemas/nutrients";

const goldenNutrients = {
  kcal: 250,
  protein_g: 12.5,
  fat_g: 8,
  carbs_g: 30,
  fibre_g: 3.2,
};

describe("nutrientsSchema", () => {
  it("should parse the five required nutrients", () => {
    expect(nutrientsSchema.parse(goldenNutrients)).toEqual(goldenNutrients);
  });

  it("should parse the optional nutrients when present", () => {
    const full = { ...goldenNutrients, sat_fat_g: 2, sugars_g: 5, salt_g: 0.4 };
    expect(nutrientsSchema.parse(full)).toEqual(full);
  });

  it("should accept null for each required nutrient, because missing data is null", () => {
    const allNull = { kcal: null, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null };
    expect(nutrientsSchema.parse(allNull)).toEqual(allNull);
  });

  it("should accept null for each optional nutrient", () => {
    const withNulls = { ...goldenNutrients, sat_fat_g: null, sugars_g: null, salt_g: null };
    expect(nutrientsSchema.parse(withNulls)).toEqual(withNulls);
  });

  it("should accept zero, because a recorded zero is not missing data", () => {
    expect(nutrientsSchema.parse({ ...goldenNutrients, fat_g: 0 }).fat_g).toBe(0);
  });

  it.each(["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"])(
    "should reject a missing %s, because the key is required even though the value may be null",
    (key) => {
      const withoutKey = Object.fromEntries(
        Object.entries(goldenNutrients).filter(([entryKey]) => entryKey !== key),
      );
      expect(nutrientsSchema.safeParse(withoutKey).success).toBe(false);
    },
  );

  it.each(["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g", "sat_fat_g", "sugars_g", "salt_g"])(
    "should reject a negative %s",
    (key) => {
      expect(nutrientsSchema.safeParse({ ...goldenNutrients, [key]: -1 }).success).toBe(false);
    },
  );

  it("should reject a non-finite number", () => {
    expect(nutrientsSchema.safeParse({ ...goldenNutrients, kcal: Infinity }).success).toBe(false);
  });
});

describe("strictNutrientsSchema", () => {
  it("should parse the five required nutrients as numbers", () => {
    expect(strictNutrientsSchema.parse(goldenNutrients)).toEqual(goldenNutrients);
  });

  it.each(["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"])(
    "should reject a null %s",
    (key) => {
      expect(strictNutrientsSchema.safeParse({ ...goldenNutrients, [key]: null }).success).toBe(
        false,
      );
    },
  );

  it("should still allow the optional nutrients to be absent or null", () => {
    expect(strictNutrientsSchema.safeParse({ ...goldenNutrients, sat_fat_g: null }).success).toBe(
      true,
    );
  });

  it("should reject a negative nutrient", () => {
    expect(strictNutrientsSchema.safeParse({ ...goldenNutrients, carbs_g: -0.1 }).success).toBe(
      false,
    );
  });
});
