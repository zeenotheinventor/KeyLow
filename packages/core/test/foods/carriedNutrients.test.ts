import { describe, expect, it } from "vitest";

import { carriedNutrients, withCarriedNutrients } from "../../src/foods/carriedNutrients";

const editedMacros = { fat_g: 10, carbs_g: 30 };

describe("carriedNutrients", () => {
  it("should carry saturated fat, sugars and salt from the source food", () => {
    const source = { sat_fat_g: 3, sugars_g: 12, salt_g: 0.8 };

    expect(carriedNutrients(source, editedMacros)).toEqual({
      sat_fat_g: 3,
      sugars_g: 12,
      salt_g: 0.8,
    });
  });

  it("should omit the keys the source food records as null, never passing null", () => {
    const source = { sat_fat_g: null, sugars_g: null, salt_g: null };

    const carried = carriedNutrients(source, editedMacros);

    expect(carried).toEqual({});
    expect(Object.keys(carried)).toEqual([]);
  });

  it("should carry a recorded zero, because zero is a value and null is the absence", () => {
    const source = { sat_fat_g: 0, sugars_g: 0, salt_g: 0 };

    expect(carriedNutrients(source, editedMacros)).toEqual({
      sat_fat_g: 0,
      sugars_g: 0,
      salt_g: 0,
    });
  });

  describe("saturated fat", () => {
    it("should be dropped when it is greater than the edited fat", () => {
      const source = { sat_fat_g: 10.1, sugars_g: null, salt_g: null };

      expect(carriedNutrients(source, editedMacros)).toEqual({});
    });

    it("should be kept when it equals the edited fat", () => {
      const source = { sat_fat_g: 10, sugars_g: null, salt_g: null };

      expect(carriedNutrients(source, editedMacros)).toEqual({ sat_fat_g: 10 });
    });

    it("should be compared with the edited fat, not the source food's fat", () => {
      const source = { sat_fat_g: 6, sugars_g: null, salt_g: null };

      expect(carriedNutrients(source, { fat_g: 5.9, carbs_g: 30 })).toEqual({});
      expect(carriedNutrients(source, { fat_g: 6, carbs_g: 30 })).toEqual({ sat_fat_g: 6 });
    });
  });

  describe("sugars", () => {
    it("should be dropped when they are greater than the edited carbs", () => {
      const source = { sat_fat_g: null, sugars_g: 30.1, salt_g: null };

      expect(carriedNutrients(source, editedMacros)).toEqual({});
    });

    it("should be kept when they equal the edited carbs", () => {
      const source = { sat_fat_g: null, sugars_g: 30, salt_g: null };

      expect(carriedNutrients(source, editedMacros)).toEqual({ sugars_g: 30 });
    });

    it("should be compared with the edited carbs, not the source food's carbs", () => {
      const source = { sat_fat_g: null, sugars_g: 8, salt_g: null };

      expect(carriedNutrients(source, { fat_g: 10, carbs_g: 7.9 })).toEqual({});
      expect(carriedNutrients(source, { fat_g: 10, carbs_g: 8 })).toEqual({ sugars_g: 8 });
    });
  });

  describe("salt", () => {
    it("should be carried however large it is, because it has no drop rule", () => {
      const source = { sat_fat_g: null, sugars_g: null, salt_g: 99 };

      expect(carriedNutrients(source, { fat_g: 0, carbs_g: 0 })).toEqual({ salt_g: 99 });
    });
  });

  it("should drop each key by its own rule without affecting the others", () => {
    const source = { sat_fat_g: 11, sugars_g: 12, salt_g: 1.5 };

    expect(carriedNutrients(source, editedMacros)).toEqual({ sugars_g: 12, salt_g: 1.5 });
  });
});

describe("withCarriedNutrients", () => {
  const input = {
    name: "Oat drink",
    basis: "per_100g" as const,
    kcal: 90,
    protein_g: 3,
    fat_g: 10,
    carbs_g: 30,
    portions: [],
  };

  it("should add the carried nutrients to the input, leaving every other key as it was", () => {
    const source = { sat_fat_g: 3, sugars_g: 12, salt_g: 0.8 };

    expect(withCarriedNutrients(source, input)).toEqual({
      ...input,
      sat_fat_g: 3,
      sugars_g: 12,
      salt_g: 0.8,
    });
  });

  it("should apply the drop rules against the fat and carbs of the input", () => {
    const source = { sat_fat_g: 10.1, sugars_g: 30.1, salt_g: 0.8 };

    expect(withCarriedNutrients(source, input)).toEqual({ ...input, salt_g: 0.8 });
  });

  it("should add no keys when the source holds none", () => {
    const source = { sat_fat_g: null, sugars_g: null, salt_g: null };

    expect(withCarriedNutrients(source, input)).toEqual(input);
  });
});
