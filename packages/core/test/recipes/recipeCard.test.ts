import { describe, expect, it } from "vitest";

import { computeRecipe, recipeCardOf } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { RecipeDraft } from "../../src/recipes";

const { ingredients } = buildChickenAndRiceRecipe();

const draftOf = (overrides: Partial<RecipeDraft> = {}): RecipeDraft => ({
  name: "Chicken and rice",
  servings: "4",
  cookedWeight: "1100",
  ingredients,
  steps: [],
  ...overrides,
});

const cardOf = (overrides: Partial<RecipeDraft> = {}) => {
  const card = recipeCardOf(draftOf(overrides));
  if (card === null) {
    throw new Error("The draft should have a card");
  }
  return card;
};

describe("recipeCardOf", () => {
  describe("the chicken and rice golden", () => {
    it("should give the per serving figures of four servings", () => {
      const card = cardOf();

      expect(card.perServing.kcal).toBeCloseTo(374.2, 9);
      expect(card.perServing.protein_g).toBeCloseTo(31.625, 9);
    });

    it("should give 275 g a serving and 136.07 kcal per 100 g of the cooked dish", () => {
      const card = cardOf();

      expect(card.servingGrams).toBe(275);
      expect(card.per100g.kcal).toBeCloseTo(136.0727, 4);
      expect(card.per100gBasis).toBe("cooked");
      expect(card.totalGrams).toBe(720);
    });

    it("should give 180 g a serving and 207.89 kcal per 100 g of the raw total with no cooked weight", () => {
      const card = cardOf({ cookedWeight: "" });

      expect(card.servingGrams).toBe(180);
      expect(card.per100g.kcal).toBeCloseTo(207.8889, 4);
      expect(card.per100gBasis).toBe("raw");
      expect(card.perServing.kcal).toBeCloseTo(374.2, 9);
      expect(card.totalGrams).toBe(720);
    });

    it("should give 299.4 kcal and 220 g for five servings", () => {
      const card = cardOf({ servings: "5" });

      expect(card.perServing.kcal).toBeCloseTo(299.36, 9);
      expect(card.servingGrams).toBe(220);
    });
  });

  describe("how the fields are read", () => {
    it("should read servings and cooked weight as an editor does", () => {
      const card = cardOf({ servings: " 2,5 ", cookedWeight: "1100.0" });

      expect(card.perServing.kcal).toBeCloseTo(1496.8 / 2.5, 9);
      expect(card.servingGrams).toBeCloseTo(1100 / 2.5, 9);
    });

    it.each([
      { name: "negative", cookedWeight: "-5" },
      { name: "zero", cookedWeight: "0" },
      { name: "not a number", cookedWeight: "abc" },
      { name: "too large", cookedWeight: "100001" },
    ])("should read a cooked weight that is $name as none", ({ cookedWeight }) => {
      const card = cardOf({ cookedWeight });

      expect(card.per100gBasis).toBe("raw");
      expect(card.servingGrams).toBe(180);
    });

    it("should accept the largest servings", () => {
      expect(recipeCardOf(draftOf({ servings: "1000" }))).not.toBeNull();
    });

    it("should accept fractional servings", () => {
      expect(cardOf({ servings: "0.5" }).servingGrams).toBe(2200);
    });
  });

  describe("when there is nothing to work out", () => {
    it.each([
      { name: "no ingredients", change: { ingredients: [] } },
      { name: "servings of 0", change: { servings: "0" } },
      { name: "servings of abc", change: { servings: "abc" } },
      { name: "blank servings", change: { servings: "" } },
      { name: "negative servings", change: { servings: "-2" } },
      { name: "servings of 1,001", change: { servings: "1001" } },
      { name: "servings of 1e3", change: { servings: "1e3" } },
    ])("should be null for $name", ({ change }) => {
      expect(recipeCardOf(draftOf(change))).toBeNull();
    });
  });

  it("should agree with computeRecipe on the same figures", () => {
    const card = cardOf();
    const computed = computeRecipe({ servings: 4, yieldGrams: 1100, ingredients });

    expect(card.perServing).toEqual(computed.perServing);
    expect(card.per100g).toEqual(computed.per100g);
    expect(card.totalGrams).toBe(computed.totalGrams);
  });

  it("should not change the draft it was given", () => {
    const draft = draftOf();
    const before = structuredClone(draft);

    recipeCardOf(draft);

    expect(draft).toEqual(before);
  });
});
