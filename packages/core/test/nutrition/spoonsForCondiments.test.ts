import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { pickerChoices } from "../../src/diary/pickerChoices";
import {
  ML_PER_TBSP,
  SPOON_PORTIONS,
  canMeasureByVolume,
  densityForLogging,
} from "../../src/nutrition/volume";
import { buildFood, buildFoodPortion } from "../../src/testing";

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must be a teaspoon and a tablespoon");
}

// The US tablespoon USDA FoodData Central weighs, in millilitres. The app's tablespoon is 15 ml.
const US_TABLESPOON_ML = 14.7868;

const cofidFood = (sourceRef: string, foodGroup: string) =>
  buildFood({
    source: "cofid",
    source_ref: sourceRef,
    food_group: foodGroup,
    basis: "per_100g",
    density_g_per_ml: null,
  });

// [CoFID code, name, CoFID food group, grams in 1 US tablespoon as the cited USDA FoodData Central row
// implies it (the cited row's grams divided by how many US tablespoons it covers)]
const condimentsWithCitedWeight: readonly (readonly [string, string, string, number])[] = [
  ["17-709", "tomato ketchup", "WCN", 17],
  ["17-723", "Worcestershire sauce", "WCN", 275 / (236.588 / US_TABLESPOON_ML)],
  ["17-705", "barbecue sauce", "WCN", 279 / (236.588 / US_TABLESPOON_ML)],
  ["17-336", "sweet and sour sauce", "WCN", 35 / 2],
  ["17-722", "tartare sauce", "WCN", 30 / 2],
  ["17-701", "French dressing", "WCG", 250 / (236.588 / US_TABLESPOON_ML)],
  ["17-716", "fat free French dressing", "WCG", 256 / (236.588 / US_TABLESPOON_ML)],
  ["17-717", "thousand island dressing", "WCG", 245 / (236.588 / US_TABLESPOON_ML)],
  ["17-715", "blue cheese dressing", "WCG", 245 / (236.588 / US_TABLESPOON_ML)],
  ["17-787", "homemade French dressing", "WC", 220 / (236.588 / US_TABLESPOON_ML)],
  ["17-788", "homemade oil and lemon dressing", "WC", 220 / (236.588 / US_TABLESPOON_ML)],
  ["17-809", "homemade mayonnaise", "WC", 220 / (236.588 / US_TABLESPOON_ML)],
  ["17-679", "reduced fat mayonnaise", "WCG", 235 / (236.588 / US_TABLESPOON_ML)],
  ["17-708", "corn, cucumber and onion relish", "WCN", 245 / (236.588 / US_TABLESPOON_ML)],
  ["17-678", "reduced salt and sugar brown sauce", "WCN", 34 / 2],
  ["17-706", "brown fruity sauce", "WCN", 34 / 2],
];

// [CoFID code, name, CoFID food group]: condiments with no honest USDA stand-in, so no spoons.
const condimentsLeftWithoutSpoons: readonly (readonly [string, string, string])[] = [
  ["17-707", "mint sauce", "WCN"],
  ["17-811", "homemade mint sauce", "WC"],
  ["17-719", "chilli sauce", "WC"],
  ["17-703", "salad cream", "WCG"],
  ["17-704", "reduced fat salad cream", "WCG"],
];

describe("spoons for condiments and table sauces", () => {
  it.each(condimentsWithCitedWeight)(
    "should let %s (%s) be measured by volume",
    (code, _name, foodGroup) => {
      expect(canMeasureByVolume(cofidFood(code, foodGroup))).toBe(true);
    },
  );

  it.each(condimentsWithCitedWeight)(
    "should weigh 1 tbsp of %s (%s) within 0.5 percent of the cited figure, allowing for the 15 ml spoon",
    (code, _name, foodGroup, gramsInUsTablespoon) => {
      const gramsInOneSpoon = (densityForLogging(cofidFood(code, foodGroup)) ?? 0) * ML_PER_TBSP;
      const expectedGrams = (gramsInUsTablespoon * ML_PER_TBSP) / US_TABLESPOON_ML;

      expect(Math.abs(gramsInOneSpoon - expectedGrams)).toBeLessThanOrEqual(expectedGrams * 0.005);
    },
  );

  it.each(condimentsLeftWithoutSpoons)(
    "should not offer spoons for %s (%s), which has no citable density",
    (code, _name, foodGroup) => {
      expect(canMeasureByVolume(cofidFood(code, foodGroup))).toBe(false);
    },
  );

  it("should resolve 1 tbsp of tomato ketchup to about 17.2 g", () => {
    const entry = buildLogEntry({
      food: cofidFood("17-709", "WCN"),
      quantity: 1,
      unit: "portion",
      portion: tablespoon,
      localDate: "2026-11-16",
      loggedAt: "2026-11-16T12:30:00+00:00",
    });

    expect(entry.resolved_grams).toBeCloseTo(17.25, 2);
  });

  it("should offer 1 tsp and 1 tbsp after g on ketchup, keeping its own default portion first", () => {
    const ketchup = cofidFood("17-709", "WCN");
    const ownPortion = buildFoodPortion({
      food_id: ketchup.id,
      label: "1 sachet",
      grams: 9,
      ml: null,
      is_default: true,
      position: 0,
    });

    const { options } = pickerChoices(ketchup, [ownPortion]);

    expect(options.map((option) => option.label)).toEqual([
      "1 sachet",
      "g",
      "ml",
      teaspoon.label,
      tablespoon.label,
      "1 cup",
    ]);
  });
});
