import { describe, expect, it } from "vitest";

import { matchPortionOnFood } from "../../src/diary/matchPortionOnFood";
import { pickerChoices } from "../../src/diary/pickerChoices";
import { previewAmount } from "../../src/diary/previewAmount";
import { startingAmount } from "../../src/diary/startingAmount";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFood, buildFoodPortion } from "../../src/testing";

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must be a teaspoon and a tablespoon");
}

const labelsOf = (choices: ReturnType<typeof pickerChoices>) =>
  choices.options.map((option) => option.label);
const valuesOf = (choices: ReturnType<typeof pickerChoices>) =>
  choices.options.map((option) => option.value);

const banana = buildFood({
  source: "cofid",
  source_ref: "14-318",
  food_group: "FA",
  name: "Bananas, flesh only",
});
const bananaPortions = [
  buildFoodPortion({ id: "banana-small", label: "1 small", grams: 101, position: 0 }),
  buildFoodPortion({
    id: "banana-medium",
    label: "1 medium",
    grams: 118,
    position: 1,
    is_default: true,
  }),
  buildFoodPortion({ id: "banana-large", label: "1 large", grams: 136, position: 2 }),
];
const slice = buildFoodPortion({
  id: "portion-slice",
  label: "1 slice",
  grams: 35,
  is_default: true,
});
const glass = buildFoodPortion({ id: "portion-glass", label: "1 glass", grams: null, ml: 200 });

// A density of its own, so these tests do not depend on the numbers in the density table.
const oil = buildFood({ density_g_per_ml: 0.92 });
const drink = buildFood({ basis: "per_100ml", density_g_per_ml: null });

describe("pickerChoices", () => {
  describe("which chips a food gets", () => {
    it("should give a volume food with one natural portion that portion, g, ml, 1 tsp and 1 tbsp", () => {
      const choices = pickerChoices(oil, [slice]);

      expect(choices.options).toEqual([
        { value: "portion-slice", label: "1 slice" },
        { value: "g", label: "g" },
        { value: "ml", label: "ml" },
        { value: "spoon-tsp", label: "1 tsp" },
        { value: "spoon-tbsp", label: "1 tbsp" },
      ]);
    });

    it("should give a banana its three sizes then g, and no ml or spoon, not even a disabled one", () => {
      const choices = pickerChoices(banana, bananaPortions);

      expect(labelsOf(choices)).toEqual(["1 small", "1 medium", "1 large", "g"]);
      expect(choices.portions).toEqual(bananaPortions);
    });

    it("should give a per 100 ml food g, ml and the spoons without a density", () => {
      expect(labelsOf(pickerChoices(drink, []))).toEqual(["g", "ml", "1 tsp", "1 tbsp"]);
    });

    it("should give a food with a density of its own the spoons", () => {
      expect(valuesOf(pickerChoices(oil, []))).toEqual(["g", "ml", "spoon-tsp", "spoon-tbsp"]);
    });

    it("should give a food with a density estimate from its group the spoons", () => {
      const cofidOil = buildFood({ source: "cofid", source_ref: null, food_group: "OC" });

      expect(labelsOf(pickerChoices(cofidOil, []))).toEqual(["g", "ml", "1 tsp", "1 tbsp"]);
    });

    it("should keep a food's millilitre portion before g and add the volume chips after it", () => {
      expect(labelsOf(pickerChoices(drink, [glass]))).toEqual([
        "1 glass",
        "g",
        "ml",
        "1 tsp",
        "1 tbsp",
      ]);
    });

    it("should say nothing of size on a chip, only the words", () => {
      const choices = pickerChoices(oil, [slice]);

      expect(labelsOf(choices).filter((label) => /\d+\s?(g|ml)\b/.test(label))).toEqual([]);
    });
  });

  describe("the order of the chips", () => {
    it("should list the food's portions in position order whatever order they come in", () => {
      const choices = pickerChoices(banana, [...bananaPortions].reverse());

      expect(labelsOf(choices)).toEqual(["1 small", "1 medium", "1 large", "g"]);
    });

    it("should put every natural portion before g", () => {
      const labels = labelsOf(pickerChoices(oil, [slice, glass]));

      expect(labels.indexOf("g")).toBe(2);
      expect(labels.slice(0, 2)).toEqual(["1 slice", "1 glass"]);
    });
  });

  describe("the list the picker works from", () => {
    it("should be the food's portions then the spoons for a volume food", () => {
      const choices = pickerChoices(oil, [slice]);

      expect(choices.portions.map((portion) => portion.id)).toEqual([
        "portion-slice",
        "spoon-tsp",
        "spoon-tbsp",
      ]);
    });

    it("should be only the food's portions when the food cannot be measured by volume", () => {
      expect(pickerChoices(banana, bananaPortions).portions.map((portion) => portion.id)).toEqual([
        "banana-small",
        "banana-medium",
        "banana-large",
      ]);
    });

    it("should have an amount for every chip that is a portion, so the preview is never dashes", () => {
      const choices = pickerChoices(oil, [slice]);

      for (const option of choices.options) {
        const { amount } = previewAmount(oil, choices.portions, option.value, "1");

        expect(amount, option.label).not.toBeNull();
      }
    });
  });

  describe("where the picker opens", () => {
    it("should open a banana on its default size, not the first, at 1", () => {
      const choices = pickerChoices(banana, bananaPortions);

      expect(startingAmount(banana, choices.portions)).toEqual({
        quantity: "1",
        unitValue: "banana-medium",
      });
    });

    it("should open a food with no natural portion on g at 100, even when it has volume chips", () => {
      const choices = pickerChoices(oil, []);

      expect(startingAmount(oil, choices.portions)).toEqual({ quantity: "100", unitValue: "g" });
    });

    it("should open a drink with no portion on ml at 100", () => {
      const choices = pickerChoices(drink, []);

      expect(startingAmount(drink, choices.portions)).toEqual({
        quantity: "100",
        unitValue: "ml",
      });
    });

    it("should open on the spoon it is given, with its count, and that chip is in the list", () => {
      const choices = pickerChoices(oil, [slice]);
      const start = startingAmount(oil, choices.portions, {
        unit: "portion",
        quantity: 2,
        portion: tablespoon,
      });

      expect(start).toEqual({ quantity: "2", unitValue: "spoon-tbsp" });
      expect(valuesOf(choices)).toContain(start.unitValue);
    });
  });

  describe("logging again a spoon entry", () => {
    it("should open on the spoon chip with its count, found through matchPortionOnFood", () => {
      const choices = pickerChoices(oil, [slice]);
      const matched = matchPortionOnFood(
        { quantity: 3, portionId: null, portion: { label: "1 tsp", ml: 5 } },
        [slice],
      );
      if (matched.unit !== "portion") {
        throw new Error("A spoon entry must match a portion");
      }

      const start = startingAmount(oil, choices.portions, matched);

      expect(start).toEqual({ quantity: "3", unitValue: teaspoon.id });
      expect(valuesOf(choices)).toContain(start.unitValue);
    });
  });
});
