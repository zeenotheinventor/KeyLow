import { describe, expect, it } from "vitest";

import { makeFood, makeOffCandidate } from "./support";

import { toFoodRowContent } from "@/components/foods/FoodSearch/foodRowContent";

describe("toFoodRowContent", () => {
  it("should bold the words that match the query in the name", () => {
    const content = toFoodRowContent(makeFood({ name: "Chicken breast, meal prep" }), "chicken");

    expect(content.nameSegments).toEqual([
      { text: "Chicken", matched: true },
      { text: " breast, meal prep", matched: false },
    ]);
  });

  it("should carry the brand when there is one and leave it out when there is not", () => {
    expect(toFoodRowContent(makeFood({ brand: "Northfield Mills" }), "oat").brand).toBe(
      "Northfield Mills",
    );
    expect("brand" in toFoodRowContent(makeFood({ brand: null }), "oat")).toBe(false);
  });

  it("should write the energy as a whole number of kcal", () => {
    expect(toFoodRowContent(makeFood({ kcal: 147.6 }), "oat").energy).toBe("148");
    expect(toFoodRowContent(makeFood({ kcal: 2480 }), "oat").energy).toBe("2,480");
  });

  it("should write the macros in grams, with a sentence for a screen reader", () => {
    const { macros } = toFoodRowContent(
      makeFood({ kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }),
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
    const content = toFoodRowContent(makeFood({ kcal: null, protein_g: 5 }), "oat");

    expect(content.note).toBe("Energy not given");
    expect("energy" in content).toBe(false);
    expect("macros" in content).toBe(false);
  });

  it("should mark a macro that is not given with a dash, never a zero", () => {
    const { macros } = toFoodRowContent(makeFood({ kcal: 100, protein_g: null }), "oat");

    expect(macros?.protein).toBe("-");
    expect(macros?.description).toContain("protein not given");
  });

  it("should name the basis only when it is not 100 g", () => {
    expect(toFoodRowContent(makeFood({ basis: "per_100ml", kcal: 42 }), "oat").basis).toBe(
      "per 100 ml",
    );
    expect("basis" in toFoodRowContent(makeFood({ basis: "per_100g" }), "oat")).toBe(false);
  });

  it("should read an Open Food Facts candidate the same way", () => {
    const content = toFoodRowContent(
      makeOffCandidate({ name: "Chicken Stock Cubes", brand: "Northfield Mills", kcal: 245 }),
      "stock cubes",
    );

    expect(content.nameSegments).toEqual([
      { text: "Chicken ", matched: false },
      { text: "Stock", matched: true },
      { text: " ", matched: false },
      { text: "Cubes", matched: true },
    ]);
    expect(content.brand).toBe("Northfield Mills");
    expect(content.energy).toBe("245");
  });
});
