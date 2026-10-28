import { foodQualitySchema } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { mapSrFood } from "../../../scripts/usda/mapSrFood";

import type { SrFood } from "../../../scripts/usda/mapSrFood";

const KCAL = 1008;
const PROTEIN = 1003;
const FAT = 1004;
const SATURATED_FAT = 1258;
const CARBS = 1005;
const SUGARS = 2000;
const FIBRE = 1079;
const SODIUM = 1093;

const srFood = (nutrients: readonly (readonly [number, number])[], overrides?: Partial<SrFood>) =>
  ({
    fdcId: "900001",
    description: "Test food, raw",
    foodGroup: "Poultry Products",
    nutrients: new Map(nutrients),
    ...overrides,
  }) satisfies SrFood;

const wholeFood = [
  [KCAL, 100],
  [PROTEIN, 10],
  [FAT, 5],
  [CARBS, 10],
  [FIBRE, 3],
] as const;

describe("mapSrFood", () => {
  describe("thigh, meat and skin, raw (FDC 172385)", () => {
    const thigh = srFood(
      [
        [KCAL, 221],
        [PROTEIN, 16.52],
        [FAT, 16.61],
        [SATURATED_FAT, 4.524],
        [CARBS, 0.25],
        [SUGARS, 0],
        [FIBRE, 0],
        [SODIUM, 81],
      ],
      { fdcId: "172385" },
    );

    it("should map the headline nutrients to the foods columns", () => {
      expect(mapSrFood(thigh, "Chicken, thigh, raw, meat and skin")).toMatchObject({
        source: "usda",
        source_ref: "172385",
        owner_id: null,
        name: "Chicken, thigh, raw, meat and skin",
        brand: null,
        barcode: null,
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 221,
        protein_g: 16.52,
        fat_g: 16.61,
        sat_fat_g: 4.524,
        carbs_g: 0.25,
        sugars_g: 0,
        fibre_g: 0,
        salt_g: 0.2025,
        food_group: "Poultry Products",
        fetched_at: null,
      });
    });

    it("should store carbs the EU way because fibre is known, and record the fibre method", () => {
      expect(mapSrFood(thigh, "x").quality).toEqual({
        carbs_convention: "eu",
        fibre_method: "aoac",
      });
    });
  });

  describe("carbohydrate", () => {
    it("should store carbohydrate less fibre", () => {
      const { carbs_g, fibre_g, quality } = mapSrFood(srFood(wholeFood), "x");

      expect(carbs_g).toBe(7);
      expect(fibre_g).toBe(3);
      expect(quality.carbs_convention).toBe("eu");
    });

    it("should keep the labelled carbohydrate as us_total and list fibre as missing when fibre is absent", () => {
      const withoutFibre = wholeFood.filter(([nutrientId]) => nutrientId !== FIBRE);

      const { carbs_g, fibre_g, quality } = mapSrFood(srFood(withoutFibre), "x");

      expect(carbs_g).toBe(10);
      expect(fibre_g).toBeNull();
      expect(quality).toEqual({ carbs_convention: "us_total", fields_missing: ["fibre_g"] });
    });

    it("should not go below zero when fibre exceeds carbohydrate", () => {
      const { carbs_g } = mapSrFood(
        srFood([
          [CARBS, 2],
          [FIBRE, 5],
        ]),
        "x",
      );

      expect(carbs_g).toBe(0);
    });
  });

  describe("missing amounts", () => {
    it("should give sugars null, not 0, when the food has no sugars figure", () => {
      expect(mapSrFood(srFood(wholeFood), "x").sugars_g).toBeNull();
    });

    it("should give salt and saturated fat null when sodium and saturates are absent", () => {
      const { salt_g, sat_fat_g } = mapSrFood(srFood(wholeFood), "x");

      expect(salt_g).toBeNull();
      expect(sat_fat_g).toBeNull();
    });

    it("should mark the food suspect and list what is missing when a core macro is absent", () => {
      const { kcal, quality } = mapSrFood(srFood([[PROTEIN, 10]]), "x");

      expect(kcal).toBeNull();
      expect(quality).toEqual({
        suspect: true,
        fields_missing: ["kcal", "fat_g", "carbs_g", "fibre_g"],
      });
    });

    it("should not mark the food suspect when only fibre is missing", () => {
      const withoutFibre = wholeFood.filter(([nutrientId]) => nutrientId !== FIBRE);

      expect(mapSrFood(srFood(withoutFibre), "x").quality.suspect).toBeUndefined();
    });
  });

  describe("salt", () => {
    it("should be sodium in mg times 2.5 over 1000, rounded to 6 places", () => {
      const { salt_g } = mapSrFood(srFood([[SODIUM, 1.23456789]]), "x");

      expect(salt_g).toBe(0.003086);
    });
  });

  describe("micros", () => {
    it("should key every other nutrient with an amount by usda_<nutrient id>, zeros included", () => {
      const { micros } = mapSrFood(
        srFood([...wholeFood, [SODIUM, 81], [1087, 7], [1162, 0], [1175, 0.347]]),
        "x",
      );

      expect(micros).toEqual({ usda_1087: 7, usda_1162: 0, usda_1175: 0.347 });
    });

    it("should list the micros in ascending nutrient id order whatever order SR gives the rows", () => {
      const { micros } = mapSrFood(
        srFood([
          [1175, 0.347],
          [1087, 7],
          [1304, 0.053],
          [1162, 0],
          [1089, 0.68],
        ]),
        "x",
      );

      expect(Object.keys(micros)).toEqual([
        "usda_1087",
        "usda_1089",
        "usda_1162",
        "usda_1175",
        "usda_1304",
      ]);
    });

    it("should be empty when the food has only the mapped nutrients", () => {
      expect(mapSrFood(srFood(wholeFood), "x").micros).toEqual({});
    });
  });

  it("should produce a quality object the foods schema accepts", () => {
    const { quality } = mapSrFood(srFood(wholeFood), "x");

    expect(foodQualitySchema.parse(quality)).toEqual(quality);
  });

  it("should leave the food group null when the SR category is unknown", () => {
    expect(mapSrFood(srFood(wholeFood, { foodGroup: null }), "x").food_group).toBeNull();
  });
});
