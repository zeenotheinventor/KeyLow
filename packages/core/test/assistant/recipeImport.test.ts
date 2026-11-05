import { describe, expect, it } from "vitest";

import { IMPORT_GUESS_MAX_AMOUNT, importedAmountOf, simplerFoodWord } from "../../src/assistant";

import type { ImportedLineMeasure } from "../../src/assistant";

const food = (overrides: Record<string, unknown> = {}) => ({
  basis: "per_100g" as const,
  source: "cofid" as const,
  source_ref: null,
  food_group: null,
  density_g_per_ml: null as number | null,
  ...overrides,
});

const portion = (id: string, label: string, grams: number, isDefault = false, position = 0) => ({
  id,
  label,
  grams,
  ml: null,
  is_default: isDefault,
  position,
});

const measure = (overrides: Partial<ImportedLineMeasure> = {}): ImportedLineMeasure => ({
  quantity: null,
  unit: null,
  guessAmount: null,
  guessUnit: null,
  ...overrides,
});

describe("simplerFoodWord", () => {
  it("should keep the last word, the head noun", () => {
    expect(simplerFoodWord("semi skimmed milk")).toBe("milk");
    expect(simplerFoodWord("  Baby   Spinach ")).toBe("spinach");
  });

  it("should keep the head noun of a flour or a milk that is only more precise", () => {
    expect(simplerFoodWord("plain flour")).toBe("flour");
    expect(simplerFoodWord("whole milk")).toBe("milk");
  });

  it.each([
    "coconut milk",
    "almond milk",
    "soy milk",
    "oat milk",
    "rice milk",
    "peanut butter",
    "cream cheese",
    "sweet potatoes",
    "tomato paste",
  ])("should not drop the word that makes %s a different food", (foodWord) => {
    expect(simplerFoodWord(foodWord)).toBeNull();
  });

  it("should have nothing simpler for one word, a short word or the same word", () => {
    expect(simplerFoodWord("milk")).toBeNull();
    expect(simplerFoodWord("red ox")).toBeNull();
    expect(simplerFoodWord("")).toBeNull();
  });
});

describe("importedAmountOf", () => {
  it("should keep grams and millilitres as they are", () => {
    expect(importedAmountOf(measure({ quantity: 800, unit: "g" }), food(), [])).toEqual({
      input: { quantity: 800, unit: "g" },
      guess: null,
    });
    expect(
      importedAmountOf(measure({ quantity: 100, unit: "ml" }), food({ basis: "per_100ml" }), []),
    ).toEqual({ input: { quantity: 100, unit: "ml" }, guess: null });
  });

  it("should turn kilograms, pounds, litres and ounces into the units the app logs in", () => {
    const amount = (quantity: number, unit: string, overrides = {}) =>
      importedAmountOf(measure({ quantity, unit }), food(overrides), [])?.input;

    expect(amount(1.5, "kg")).toEqual({ quantity: 1500, unit: "g" });
    expect(amount(2, "oz")).toEqual({ quantity: 2, unit: "oz" });
    expect(amount(1, "lb")).toEqual({ quantity: 16, unit: "oz" });
    expect(amount(1, "litre", { basis: "per_100ml" })).toEqual({ quantity: 1000, unit: "ml" });
    expect(amount(4, "fl oz", { basis: "per_100ml" })).toEqual({ quantity: 4, unit: "fl_oz" });
  });

  it("should log a spoon as the app's own spoon portion, for a food that can be measured by volume", () => {
    const oil = food({ density_g_per_ml: 0.9 });

    expect(importedAmountOf(measure({ quantity: 2, unit: "tbsp" }), oil, [])).toEqual({
      input: {
        quantity: 2,
        unit: "portion",
        portion: { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 },
      },
      guess: null,
    });
    expect(
      importedAmountOf(measure({ quantity: 1, unit: "Teaspoons" }), oil, [])?.input,
    ).toMatchObject({
      portion: { id: "spoon-tsp" },
    });
    expect(importedAmountOf(measure({ quantity: 1, unit: "cup" }), oil, [])?.input).toMatchObject({
      portion: { id: "spoon-cup" },
    });
  });

  it("should leave a volume of a food with no density unresolved, because it would be saved as grams", () => {
    expect(importedAmountOf(measure({ quantity: 2, unit: "tbsp" }), food(), [])).toBeNull();
    expect(importedAmountOf(measure({ quantity: 100, unit: "ml" }), food(), [])).toBeNull();
  });

  it("should count in the food's default portion, else its first", () => {
    const portions = [
      portion("p2", "1 medium", 60, false, 1),
      portion("p1", "1 large", 70, true, 0),
    ];

    expect(importedAmountOf(measure({ quantity: 2 }), food(), portions)?.input).toMatchObject({
      quantity: 2,
      unit: "portion",
      portion: { id: "p1" },
    });
    expect(
      importedAmountOf(measure({ quantity: 2 }), food(), [portion("p2", "1 medium", 60, false, 1)])
        ?.input,
    ).toMatchObject({ portion: { id: "p2" } });
  });

  it("should count only in a portion whose label names the thing, never in a measure like 100 g", () => {
    const named = portion("p1", "1 large", 150, false, 1);

    expect(
      importedAmountOf(measure({ quantity: 3 }), food(), [portion("p0", "100 g", 100, true, 0)]),
    ).toBeNull();
    expect(
      importedAmountOf(measure({ quantity: 3 }), food(), [portion("p0", "1 cup", 240, true, 0)]),
    ).toBeNull();
    expect(
      importedAmountOf(measure({ quantity: 3 }), food(), [
        portion("p0", "100 g", 100, true, 0),
        named,
      ])?.input,
    ).toMatchObject({ quantity: 3, unit: "portion", portion: { id: "p1" } });
    expect(
      importedAmountOf(measure({ quantity: 1 }), food(), [portion("p0", "slice", 30, true, 0)])
        ?.input,
    ).toMatchObject({ portion: { id: "p0" } });
  });

  it("should leave a count of a food with no portions, and a unit it cannot convert, unresolved", () => {
    expect(importedAmountOf(measure({ quantity: 4 }), food(), [])).toBeNull();
    expect(importedAmountOf(measure({ quantity: 1, unit: "pinch" }), food(), [])).toBeNull();
    expect(
      importedAmountOf(measure({ quantity: 1, unit: "bunch", guessAmount: 20 }), food(), []),
    ).toBeNull();
  });

  it("should guess a line with no quantity, in the unit the model gave, within the cap", () => {
    const milk = food({ density_g_per_ml: 1.03 });

    expect(importedAmountOf(measure({ guessAmount: 50, guessUnit: "ml" }), milk, [])).toEqual({
      input: { quantity: 50, unit: "ml" },
      guess: { amount: 50, unit: "ml" },
    });
    expect(importedAmountOf(measure({ guessAmount: 400, guessUnit: "g" }), milk, [])).toEqual({
      input: { quantity: IMPORT_GUESS_MAX_AMOUNT, unit: "g" },
      guess: { amount: IMPORT_GUESS_MAX_AMOUNT, unit: "g" },
    });
    expect(IMPORT_GUESS_MAX_AMOUNT).toBe(100);
  });

  it("should leave a line with no quantity and no usable guess unresolved", () => {
    expect(importedAmountOf(measure(), food(), [])).toBeNull();
    expect(importedAmountOf(measure({ guessAmount: 0, guessUnit: "g" }), food(), [])).toBeNull();
    expect(importedAmountOf(measure({ guessAmount: -5, guessUnit: "g" }), food(), [])).toBeNull();
    expect(importedAmountOf(measure({ guessAmount: 5 }), food(), [])).toBeNull();
  });

  it("should leave a guessed volume of a food that cannot be measured by volume unresolved", () => {
    expect(importedAmountOf(measure({ guessAmount: 50, guessUnit: "ml" }), food(), [])).toBeNull();
  });

  it("should treat a zero or negative quantity as no quantity", () => {
    expect(importedAmountOf(measure({ quantity: 0, unit: "g" }), food(), [])).toBeNull();
    expect(
      importedAmountOf(measure({ quantity: 0, guessAmount: 20, guessUnit: "g" }), food(), [])
        ?.guess,
    ).toEqual({ amount: 20, unit: "g" });
  });
});
