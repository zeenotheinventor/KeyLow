import { describe, expect, it } from "vitest";

import { describeFoodRow } from "../../src/search";

import type { Food } from "../../src/schemas";

type FoodRowSource = Pick<
  Food,
  "name" | "brand" | "kcal" | "basis" | "protein_g" | "fat_g" | "carbs_g"
>;

const food = (changes: Partial<FoodRowSource> = {}): FoodRowSource => ({
  name: "Overnight oats",
  brand: null,
  kcal: 380,
  basis: "per_100g",
  protein_g: 13,
  fat_g: 7,
  carbs_g: 60,
  ...changes,
});

describe("describeFoodRow", () => {
  it("should bold the words that match the query in the name", () => {
    const row = describeFoodRow(food({ name: "Chicken breast, meal prep" }), "chicken");

    expect(row.nameSegments).toEqual([
      { text: "Chicken", matched: true },
      { text: " breast, meal prep", matched: false },
    ]);
  });

  it("should carry the brand when there is one and leave it out when there is not", () => {
    expect(describeFoodRow(food({ brand: "Northfield Mills" }), "oat").brand).toBe(
      "Northfield Mills",
    );
    expect("brand" in describeFoodRow(food({ brand: null }), "oat")).toBe(false);
  });

  it("should write the energy as a whole number of kcal", () => {
    expect(describeFoodRow(food({ kcal: 147.6 }), "oat").energy).toBe("148");
    expect(describeFoodRow(food({ kcal: 2480 }), "oat").energy).toBe("2,480");
  });

  it("should write the macros in grams, with a sentence for a screen reader", () => {
    const { macros } = describeFoodRow(
      food({ kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }),
      "oat",
    );

    expect(macros).toEqual({
      protein: "31",
      carbs: "0",
      fat: "3.6",
      description: "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams",
    });
  });

  it("should say energy is not given, with no macros, when the food has no energy", () => {
    const row = describeFoodRow(food({ kcal: null, protein_g: 5 }), "oat");

    expect(row.note).toBe("Energy not given");
    expect("energy" in row).toBe(false);
    expect("macros" in row).toBe(false);
  });

  it("should mark a macro that is not given with a dash, never a zero", () => {
    const { macros } = describeFoodRow(food({ kcal: 100, protein_g: null }), "oat");

    expect(macros?.protein).toBe("-");
    expect(macros?.description).toContain("protein not given");
  });

  it("should name the basis only when it is not 100 g", () => {
    expect(describeFoodRow(food({ basis: "per_100ml", kcal: 42 }), "oat").basis).toBe("per 100 ml");
    expect("basis" in describeFoodRow(food({ basis: "per_100g" }), "oat")).toBe(false);
  });

  it("should still name the basis when the energy is not given", () => {
    const row = describeFoodRow(food({ basis: "per_100ml", kcal: null }), "oat");

    expect(row.basis).toBe("per 100 ml");
    expect(row.note).toBe("Energy not given");
  });

  it("should read a candidate with only the row fields the same way", () => {
    const row = describeFoodRow(
      food({ name: "Chicken Stock Cubes", brand: "Northfield Mills", kcal: 245 }),
      "stock cubes",
    );

    expect(row.nameSegments).toEqual([
      { text: "Chicken ", matched: false },
      { text: "Stock", matched: true },
      { text: " ", matched: false },
      { text: "Cubes", matched: true },
    ]);
    expect(row.brand).toBe("Northfield Mills");
    expect(row.energy).toBe("245");
  });
});
