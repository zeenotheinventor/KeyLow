import { foodFixture } from "./support/apiClientMock";
import { offCandidateFixture } from "./support/searchApiClientMock";
import { toFoodRowProps } from "../../components/FoodSearch/toFoodRowProps";

import type { Food } from "@keylow/core/schemas";

const food = (changes: Partial<Food> = {}): Food => ({ ...foodFixture, ...changes });

describe("toFoodRowProps", () => {
  it("should bold the words that match the query in the name", () => {
    const row = toFoodRowProps(food({ name: "Chicken breast, meal prep" }), "chicken");

    expect(row.nameSegments).toEqual([
      { text: "Chicken", matched: true },
      { text: " breast, meal prep", matched: false },
    ]);
  });

  it("should carry the brand when there is one and leave it out when there is not", () => {
    expect(toFoodRowProps(food({ brand: "Northfield Mills" }), "oat").brand).toBe(
      "Northfield Mills",
    );
    expect("brand" in toFoodRowProps(food({ brand: null }), "oat")).toBe(false);
  });

  it("should write the energy as a whole number of kcal", () => {
    expect(toFoodRowProps(food({ kcal: 147.6 }), "oat").energy).toBe("148");
    expect(toFoodRowProps(food({ kcal: 2480 }), "oat").energy).toBe("2,480");
  });

  it("should write the macros in grams, with a sentence for a screen reader", () => {
    const { macros } = toFoodRowProps(
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
    const row = toFoodRowProps(food({ kcal: null, protein_g: 5 }), "oat");

    expect(row.note).toBe("Energy not given");
    expect("energy" in row).toBe(false);
    expect("macros" in row).toBe(false);
  });

  it("should mark a macro that is not given with a dash, never a zero", () => {
    const { macros } = toFoodRowProps(food({ kcal: 100, protein_g: null }), "oat");

    expect(macros?.protein).toBe("-");
    expect(macros?.description).toContain("protein not given");
  });

  it("should name the basis only when it is not 100 g", () => {
    expect(toFoodRowProps(food({ basis: "per_100ml", kcal: 42 }), "oat").basis).toBe("per 100 ml");
    expect("basis" in toFoodRowProps(food({ basis: "per_100g" }), "oat")).toBe(false);
  });

  it("should read an Open Food Facts candidate the same way", () => {
    const row = toFoodRowProps(
      { ...offCandidateFixture, name: "Chicken Stock Cubes", brand: "Northfield Mills", kcal: 245 },
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
