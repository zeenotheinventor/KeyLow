import { describe, expect, it } from "vitest";

import { LABEL_KCAL_TOLERANCE, labelFoodInput, macroKcalOf } from "../../src/foods";

import type { LabelFoodValues } from "../../src/foods";

const proteinBar: LabelFoodValues = {
  name: "My protein bar",
  brand: null,
  per: "per_portion",
  portion_label: "1 bar",
  portion_grams: 60,
  kcal: 210,
  protein_g: 20,
  carbs_g: 19,
  fat_g: 6,
};

describe("macroKcalOf", () => {
  it("should add 4 per gram of protein and carbs and 9 per gram of fat", () => {
    expect(macroKcalOf({ protein_g: 20, carbs_g: 19, fat_g: 6 })).toBe(210);
  });
});

describe("labelFoodInput", () => {
  it("should turn a per portion label into a food per 100 g with its one natural portion", () => {
    const result = labelFoodInput(proteinBar);

    expect(result).toEqual({
      ok: true,
      food: {
        name: "My protein bar",
        basis: "per_100g",
        kcal: 350,
        protein_g: 33.33,
        carbs_g: 31.67,
        fat_g: 10,
        portions: [{ label: "1 bar", grams: 60, isDefault: true }],
      },
    });
  });

  it("should keep a per 100 g label as it is, with no portion", () => {
    const result = labelFoodInput({
      ...proteinBar,
      per: "per_100g",
      portion_label: null,
      portion_grams: null,
      kcal: 400,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 13,
      brand: "Acme",
    });

    expect(result).toEqual({
      ok: true,
      food: {
        name: "My protein bar",
        brand: "Acme",
        basis: "per_100g",
        kcal: 400,
        protein_g: 30,
        carbs_g: 40,
        fat_g: 13,
        portions: [],
      },
    });
  });

  it("should accept a label within the tolerance of its macros", () => {
    expect(LABEL_KCAL_TOLERANCE).toBe(0.15);
    // 14.3 percent over the 210 kcal the macros make.
    expect(labelFoodInput({ ...proteinBar, kcal: 240 }).ok).toBe(true);
    expect(labelFoodInput({ ...proteinBar, kcal: 180 }).ok).toBe(true);
  });

  it("should refuse a label whose kcal is more than 15 percent from its macros and name the macros' kcal", () => {
    expect(labelFoodInput({ ...proteinBar, kcal: 250 })).toEqual({
      ok: false,
      fields: ["kcal"],
      macroKcal: 210,
    });
    expect(labelFoodInput({ ...proteinBar, kcal: 150 })).toEqual({
      ok: false,
      fields: ["kcal"],
      macroKcal: 210,
    });
  });

  it("should refuse any energy on a label with no macros but allow none", () => {
    const empty = { protein_g: 0, carbs_g: 0, fat_g: 0 };

    expect(labelFoodInput({ ...proteinBar, ...empty, kcal: 5 }).ok).toBe(false);
    expect(labelFoodInput({ ...proteinBar, ...empty, kcal: 0 }).ok).toBe(true);
  });

  it("should need a label and grams for a per portion food and neither for a per 100 g food", () => {
    expect(labelFoodInput({ ...proteinBar, portion_label: null })).toMatchObject({
      ok: false,
      fields: ["portion_label"],
    });
    expect(labelFoodInput({ ...proteinBar, portion_grams: null })).toMatchObject({
      ok: false,
      fields: ["portion_grams"],
    });
    expect(labelFoodInput({ ...proteinBar, per: "per_100g" })).toMatchObject({
      ok: false,
      fields: ["portion_label", "portion_grams"],
    });
    expect(
      labelFoodInput({ ...proteinBar, per: "per_100g", portion_label: null, portion_grams: 60 }),
    ).toMatchObject({ ok: false, fields: ["portion_grams"] });
  });

  it("should refuse numbers the food form would refuse and name the field", () => {
    // 210 kcal in 10 g is 2,100 kcal per 100 g, which is more than any food holds.
    const result = labelFoodInput({ ...proteinBar, portion_grams: 10 });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.fields).toContain("kcal");
  });
});
