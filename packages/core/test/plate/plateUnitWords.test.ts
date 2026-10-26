import { describe, expect, it } from "vitest";

import { banana, chickenAndRice, greekYoghurt, naan, readyMeal, semiSkimmedMilk } from "./sample";
import {
  plateItemOfHit,
  plateItemOfRecipe,
  plateUnitWord,
  plateUnitWords,
  setPlateQuantity,
} from "../../src/plate";

describe("plateUnitWords", () => {
  it("should be serving and servings for a recipe by serving, and g for grams", () => {
    expect(plateUnitWords(plateItemOfRecipe({ key: "r", recipe: chickenAndRice }))).toEqual({
      singular: "serving",
      plural: "servings",
    });
    expect(
      plateUnitWords(
        plateItemOfRecipe({ key: "r", recipe: chickenAndRice, amount: { quantity: 1, unit: "g" } }),
      ),
    ).toEqual({ singular: "g", plural: "g" });
  });

  it("should be the noun of the portion, with its plural", () => {
    expect(plateUnitWords(plateItemOfHit("a", greekYoghurt))).toEqual({
      singular: "pot",
      plural: "pots",
    });
    expect(plateUnitWords(plateItemOfHit("b", readyMeal))).toEqual({
      singular: "pack",
      plural: "packs",
    });
    expect(plateUnitWords(plateItemOfHit("c", naan))).toEqual({
      singular: "naan",
      plural: "naans",
    });
  });

  it("should leave a size word as it is", () => {
    expect(plateUnitWords(plateItemOfHit("a", banana))).toEqual({
      singular: "medium",
      plural: "medium",
    });
  });

  it("should write the plural of a noun that ends in y, s, x, z, ch or sh", () => {
    const wordsOf = (label: string) =>
      plateUnitWords(plateItemOfHit("a", { ...greekYoghurt, default_portion_label: label })).plural;

    expect(wordsOf("1 berry")).toBe("berries");
    expect(wordsOf("1 glass")).toBe("glasses");
    expect(wordsOf("1 box")).toBe("boxes");
    expect(wordsOf("1 sandwich")).toBe("sandwiches");
    expect(wordsOf("1 dish")).toBe("dishes");
    expect(wordsOf("1 day")).toBe("days");
  });

  it.each([
    ["1 tomato", "tomato", "tomatoes"],
    ["1 potato", "potato", "potatoes"],
    ["1 cherry tomato", "cherry tomato", "cherry tomatoes"],
    ["1 leaf", "leaf", "leaves"],
    ["1 loaf", "loaf", "loaves"],
    ["1 apricot half", "apricot half", "apricot halves"],
    ["1 avocado", "avocado", "avocados"],
  ])(
    "should write the plural of %j with the endings real nouns take",
    (label, singular, plural) => {
      expect(
        plateUnitWords(plateItemOfHit("a", { ...greekYoghurt, default_portion_label: label })),
      ).toEqual({ singular, plural });
    },
  );

  it("should leave a spoon as it is, as the picker writes it", () => {
    const spoons = (label: string) =>
      plateUnitWords(
        plateItemOfHit("a", {
          ...semiSkimmedMilk,
          default_portion_id: "s",
          default_portion_label: label,
          default_portion_ml: 15,
        }),
      );

    expect(spoons("1 tsp")).toEqual({ singular: "tsp", plural: "tsp" });
    expect(spoons("1 tbsp")).toEqual({ singular: "tbsp", plural: "tbsp" });
  });

  it("should leave a two word size as it is", () => {
    expect(
      plateUnitWords(plateItemOfHit("a", { ...banana, default_portion_label: "1 extra large" })),
    ).toEqual({ singular: "extra large", plural: "extra large" });
  });

  it("should pluralise the noun before 'of' in a label such as a slice of bread", () => {
    expect(
      plateUnitWords(
        plateItemOfHit("a", { ...greekYoghurt, default_portion_label: "1 slice of bread" }),
      ),
    ).toEqual({ singular: "slice of bread", plural: "slices of bread" });
  });

  it("should fall back to portion and portions for a label with a number in its noun", () => {
    expect(
      plateUnitWords(plateItemOfHit("a", { ...greekYoghurt, default_portion_label: "Box of 6" })),
    ).toEqual({ singular: "portion", plural: "portions" });
  });

  it("should fall back to portion and portions when the label gives no noun", () => {
    expect(
      plateUnitWords(plateItemOfHit("a", { ...greekYoghurt, default_portion_label: "30 g" })),
    ).toEqual({ singular: "portion", plural: "portions" });
  });

  it("should be g and ml for a weight and a volume", () => {
    expect(plateUnitWords(plateItemOfHit("m", semiSkimmedMilk))).toEqual({
      singular: "ml",
      plural: "ml",
    });
  });
});

describe("plateUnitWord", () => {
  it("should be the singular for exactly 1 and the plural otherwise", () => {
    const pot = plateItemOfHit("a", greekYoghurt);
    const [two] = setPlateQuantity([pot], "a", "2");
    const [half] = setPlateQuantity([pot], "a", "0.5");
    const [empty] = setPlateQuantity([pot], "a", "");

    expect(plateUnitWord(pot)).toBe("pot");
    expect(two && plateUnitWord(two)).toBe("pots");
    expect(half && plateUnitWord(half)).toBe("pots");
    expect(empty && plateUnitWord(empty)).toBe("pots");
  });
});
