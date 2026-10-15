import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary/buildFoodSnapshot";
import { foodSnapshotSchema } from "../../src/diary/schemas";
import { buildFood, buildFoodPortion } from "../../src/testing";

const bread = buildFood({
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Bread",
  kcal: 250,
  protein_g: 9,
  fat_g: 3,
  carbs_g: 48,
});
const milk = buildFood({
  id: "00000000-0000-4000-8000-0000000000b2",
  name: "Milk",
  basis: "per_100ml",
  density_g_per_ml: 1.03,
  kcal: 64,
});
const oliveOil = buildFood({
  id: "00000000-0000-4000-8000-0000000000b3",
  name: "Olive oil",
  density_g_per_ml: 0.91,
  kcal: 884,
});

describe("buildFoodSnapshot", () => {
  it("should freeze the food as it is now with the quantity it was logged at", () => {
    const snapshot = buildFoodSnapshot(bread, { quantity: 80, unit: "g" });

    expect(snapshot).toEqual({
      v: 1,
      kind: "food",
      ref: "00000000-0000-4000-8000-0000000000b1",
      name: "Bread",
      basis: "per_100g",
      per100: { kcal: 250, protein_g: 9, fat_g: 3, carbs_g: 48, fibre_g: null },
      quantity: 80,
      unit: "g",
      portion: null,
      density: null,
      resolvedGrams: 80,
      engineVersion: 1,
    });
  });

  it("should produce a snapshot that its own schema accepts", () => {
    const snapshot = buildFoodSnapshot(bread, { quantity: 80, unit: "g" });

    expect(foodSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  describe("per100", () => {
    it("should keep a null required nutrient as null", () => {
      const snapshot = buildFoodSnapshot(buildFood({ protein_g: null, fat_g: null }), {
        quantity: 100,
        unit: "g",
      });

      expect(snapshot.per100).toEqual({
        kcal: 100,
        protein_g: null,
        fat_g: null,
        carbs_g: 20,
        fibre_g: null,
      });
    });

    it("should omit a null optional nutrient instead of writing null", () => {
      const snapshot = buildFoodSnapshot(buildFood({ sat_fat_g: null }), {
        quantity: 100,
        unit: "g",
      });

      expect(Object.keys(snapshot.per100)).toEqual([
        "kcal",
        "protein_g",
        "fat_g",
        "carbs_g",
        "fibre_g",
      ]);
    });

    it("should carry an optional nutrient that has a value, including zero", () => {
      const snapshot = buildFoodSnapshot(buildFood({ sat_fat_g: 1.5, sugars_g: 0, salt_g: null }), {
        quantity: 100,
        unit: "g",
      });

      expect(snapshot.per100).toEqual({
        kcal: 100,
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
        fibre_g: null,
        sat_fat_g: 1.5,
        sugars_g: 0,
      });
    });

    it("should not carry micronutrients or the food group", () => {
      const snapshot = buildFoodSnapshot(
        buildFood({ micros: { iron_mg: 2 }, food_group: "Bread" }),
        { quantity: 100, unit: "g" },
      );

      expect(JSON.stringify(snapshot)).not.toContain("iron_mg");
      expect(JSON.stringify(snapshot)).not.toContain("food_group");
    });
  });

  describe("resolvedGrams", () => {
    it("should be the grams for the g unit", () => {
      expect(buildFoodSnapshot(milk, { quantity: 250, unit: "g" }).resolvedGrams).toBe(250);
    });

    it("should convert millilitres to grams with the density", () => {
      expect(buildFoodSnapshot(milk, { quantity: 250, unit: "ml" }).resolvedGrams).toBeCloseTo(
        257.5,
        10,
      );
    });

    it("should convert ounces to grams", () => {
      expect(buildFoodSnapshot(bread, { quantity: 2, unit: "oz" }).resolvedGrams).toBeCloseTo(
        56.699,
        10,
      );
    });

    it("should assume 1 g per ml when the food has no density", () => {
      const water = buildFood({ basis: "per_100ml", density_g_per_ml: null });

      expect(buildFoodSnapshot(water, { quantity: 200, unit: "ml" }).resolvedGrams).toBe(200);
    });
  });

  describe("portion", () => {
    it("should be null for the g unit even when a portion is passed", () => {
      const portion = buildFoodPortion({ label: "Slice", grams: 35 });

      expect(buildFoodSnapshot(bread, { quantity: 80, unit: "g", portion }).portion).toBeNull();
    });

    it("should be null for the ml unit", () => {
      expect(buildFoodSnapshot(milk, { quantity: 250, unit: "ml" }).portion).toBeNull();
    });

    it("should be label and grams for a gram portion, with no ml key", () => {
      const portion = buildFoodPortion({ label: "Slice", grams: 35, ml: null });

      const snapshot = buildFoodSnapshot(bread, { quantity: 2, unit: "portion", portion });

      expect(snapshot.portion).toStrictEqual({ label: "Slice", grams: 35 });
    });

    it("should be label and ml for a millilitre portion, with no grams key", () => {
      const portion = buildFoodPortion({ label: "Glass", grams: null, ml: 200 });

      const snapshot = buildFoodSnapshot(milk, { quantity: 1, unit: "portion", portion });

      expect(snapshot.portion).toStrictEqual({ label: "Glass", ml: 200 });
    });

    it("should throw when the portion unit is used without a portion", () => {
      expect(() => buildFoodSnapshot(bread, { quantity: 1, unit: "portion" })).toThrow(RangeError);
    });
  });

  describe("goldens", () => {
    it("should resolve 2 slices of 35 g to 70 g", () => {
      const portion = buildFoodPortion({ label: "Slice", grams: 35 });

      const snapshot = buildFoodSnapshot(bread, { quantity: 2, unit: "portion", portion });

      expect(snapshot.resolvedGrams).toBe(70);
    });

    it("should resolve 1 tablespoon of 15 ml olive oil to 13.65 g", () => {
      const portion = buildFoodPortion({ label: "Tablespoon", grams: null, ml: 15 });

      const snapshot = buildFoodSnapshot(oliveOil, { quantity: 1, unit: "portion", portion });

      expect(snapshot.resolvedGrams).toBeCloseTo(13.65, 10);
    });
  });

  it("should store the density the food had", () => {
    expect(buildFoodSnapshot(milk, { quantity: 250, unit: "ml" }).density).toBe(1.03);
  });
});

describe("foodSnapshotSchema", () => {
  const valid = buildFoodSnapshot(bread, { quantity: 80, unit: "g" });

  it("should reject a snapshot with an unknown version", () => {
    expect(foodSnapshotSchema.safeParse({ ...valid, v: 2 }).success).toBe(false);
  });

  it("should reject a portion on a snapshot whose unit is not portion", () => {
    const withPortion = { ...valid, portion: { label: "Slice", grams: 35 } };

    expect(foodSnapshotSchema.safeParse(withPortion).success).toBe(false);
  });

  it("should reject a snapshot whose unit is portion but has no portion", () => {
    expect(foodSnapshotSchema.safeParse({ ...valid, unit: "portion" }).success).toBe(false);
  });

  it("should reject a portion with both grams and ml", () => {
    const both = { ...valid, unit: "portion", portion: { label: "Slice", grams: 35, ml: 10 } };

    expect(foodSnapshotSchema.safeParse(both).success).toBe(false);
  });

  it("should strip a micronutrient key from per100 when parsing", () => {
    const micros = { ...valid, per100: { ...valid.per100, iron_mg: 2 } };

    expect(JSON.stringify(foodSnapshotSchema.parse(micros))).not.toContain("iron_mg");
  });
});
