import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { COFID_DENSITY_OVERRIDES } from "../../src/nutrition/density";
import {
  ML_PER_TBSP,
  ML_PER_TSP,
  SPOON_PORTIONS,
  canMeasureByVolume,
  densityForLogging,
} from "../../src/nutrition/volume";
import { buildFood } from "../../src/testing";

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must be a teaspoon and a tablespoon");
}

// The US tablespoon USDA FoodData Central weighs, in millilitres. The app's tablespoon is 15 ml.
const US_TABLESPOON_ML = 14.7868;

/** A CoFID food as the importer stores it, in the herbs and spices group H unless told otherwise. */
const cofidFood = (sourceRef: string, foodGroup = "H") =>
  buildFood({
    source: "cofid",
    source_ref: sourceRef,
    food_group: foodGroup,
    basis: "per_100g",
    density_g_per_ml: null,
  });

// [CoFID code, name, grams in 1 US tablespoon as USDA FoodData Central SR Legacy weighs it]
const spicesWithCitedTablespoon: readonly (readonly [string, string, number])[] = [
  ["13-830", "garlic powder", 9.7],
  ["13-880", "black pepper", 6.9],
  ["13-881", "white pepper", 7.1],
  ["13-879", "paprika", 6.8],
  ["13-873", "chilli powder", 8.0],
  ["13-874", "ground cinnamon", 7.8],
  ["13-861", "ground turmeric", 9.4],
  ["13-832", "ground ginger", 5.2],
  ["13-889", "cumin seeds", 6.0],
  ["13-876", "curry powder", 6.3],
  ["13-877", "ground nutmeg", 7.0],
  ["13-847", "cayenne pepper", 5.3],
  ["13-845", "dried parsley", 1.6],
  ["13-883", "dried thyme", 4.3],
];

// [CoFID code, name, CoFID food group]: foods whose spoons come from another US measure.
const otherFoodsMeasuredByVolume: readonly (readonly [string, string, string])[] = [
  ["13-878", "dried oregano", "H"],
  ["13-882", "dried rosemary", "H"],
  ["13-805", "dried basil", "H"],
  ["17-367", "salt", "WY"],
  ["17-356", "bicarbonate of soda", "WY"],
  ["17-355", "baking powder", "WY"],
  ["17-339", "vinegar", "WY"],
  ["17-721", "soy sauce", "WCN"],
  ["17-654", "mayonnaise", "WCG"],
  ["14-892", "smooth peanut butter", "GA"],
  ["12-545", "cocoa powder", "BH"],
  ["11-788", "porridge oats", "A"],
  ["11-861", "long grain white rice", "AC"],
];

describe("spoons for spices, herbs and pantry foods", () => {
  it.each(spicesWithCitedTablespoon)("should let %s (%s) be measured by volume", (code) => {
    expect(canMeasureByVolume(cofidFood(code))).toBe(true);
  });

  it.each(otherFoodsMeasuredByVolume)(
    "should let %s (%s) be measured by volume",
    (code, _name, foodGroup) => {
      expect(canMeasureByVolume(cofidFood(code, foodGroup))).toBe(true);
    },
  );

  it("should resolve 1 tbsp of garlic powder to the cited 9.7 g, allowing for the 15 ml spoon", () => {
    const entry = buildLogEntry({
      food: cofidFood("13-830"),
      quantity: 1,
      unit: "portion",
      portion: tablespoon,
      localDate: "2026-10-22",
      loggedAt: "2026-10-22T12:30:00+01:00",
    });

    // 9.7 g in a 14.7868 ml US tablespoon is 0.656 g/ml, which makes 9.84 g in the app's 15 ml.
    expect(entry.resolved_grams).toBeCloseTo(0.656 * ML_PER_TBSP, 10);
    expect(entry.resolved_grams).toBeCloseTo(9.7, 0);
  });

  it("should resolve 1 tsp of garlic powder to a third of 1 tbsp", () => {
    const food = cofidFood("13-830");
    const input = {
      food,
      quantity: 1,
      unit: "portion",
      localDate: "2026-10-22",
      loggedAt: "2026-10-22T12:30:00+01:00",
    } as const;

    const teaspoonGrams = buildLogEntry({ ...input, portion: teaspoon }).resolved_grams;
    const tablespoonGrams = buildLogEntry({ ...input, portion: tablespoon }).resolved_grams;

    expect(teaspoonGrams).toBeCloseTo((tablespoonGrams * ML_PER_TSP) / ML_PER_TBSP, 10);
  });

  it.each(spicesWithCitedTablespoon)(
    "should weigh 1 tbsp of %s (%s) within 0.5 percent of the cited %s g, allowing for the 15 ml spoon",
    (code, _name, citedGrams) => {
      const gramsInOneSpoon = (densityForLogging(cofidFood(code)) ?? 0) * ML_PER_TBSP;
      const expectedGrams = (citedGrams * ML_PER_TBSP) / US_TABLESPOON_ML;

      expect(Math.abs(gramsInOneSpoon - expectedGrams)).toBeLessThanOrEqual(expectedGrams * 0.005);
    },
  );

  it("should keep a density a user entered on the food ahead of the cited one", () => {
    const food = buildFood({ ...cofidFood("13-830"), density_g_per_ml: 0.5 });

    expect(densityForLogging(food)).toBe(0.5);
  });

  it("should name where every override came from", () => {
    const withoutSource = Object.entries(COFID_DENSITY_OVERRIDES).filter(
      ([, entry]) => entry.source.trim() === "",
    );

    expect(withoutSource).toEqual([]);
  });
});
