import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import {
  ML_PER_TBSP,
  SPOON_PORTIONS,
  canMeasureByVolume,
  densityForLogging,
} from "../../src/nutrition/volume";
import { buildFood } from "../../src/testing";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

// The US cup USDA FoodData Central weighs its household portions in, in millilitres.
const US_CUP_ML = 236.588;

/** A CoFID food as the importer stores it: no density of its own, in the given CoFID food group. */
const cofidFood = (sourceRef: string, foodGroup: string) =>
  buildFood({
    source: "cofid",
    source_ref: sourceRef,
    food_group: foodGroup,
    basis: "per_100g",
    density_g_per_ml: null,
  });

// [CoFID code, name, CoFID food group, grams in 1 US cup as USDA FoodData Central SR Legacy weighs it]
const peasAndSweetcornWithCitedCup: readonly (readonly [string, string, string, number])[] = [
  ["13-438", "Peas, raw", "DF", 145],
  ["13-439", "Peas, boiled in unsalted water", "DF", 160],
  ["13-527", "Peas, frozen, raw", "DF", 134],
  ["13-536", "Peas, frozen, boiled in unsalted water", "DF", 160],
  ["13-564", "Peas, canned in water, re-heated, drained", "DF", 170],
  ["13-141", "Peas, split, dried, raw", "DF", 196],
  ["13-142", "Peas, split, dried, boiled in unsalted water", "DF", 196],
  ["13-122", "Peas, mange-tout, raw", "DF", 63],
  ["13-641", "Peas, mange-tout, boiled in unsalted water", "DF", 160],
  ["13-143", "Peas, sugar-snap, raw", "DF", 63],
  ["13-594", "Peas, sugar-snap, boiled in unsalted water", "DG", 160],
  ["13-622", "Sweetcorn, kernels, raw", "DG", 145],
  ["13-508", "Sweetcorn, kernels, boiled 'on the cob' in unsalted water", "DG", 149],
  ["13-529", "Sweetcorn kernels, canned in water, drained", "DG", 164],
];

describe("volume measures for peas and sweetcorn", () => {
  it.each(peasAndSweetcornWithCitedCup)(
    "should let %s (%s) be measured by volume",
    (code, _name, foodGroup) => {
      expect(canMeasureByVolume(cofidFood(code, foodGroup))).toBe(true);
    },
  );

  it.each(peasAndSweetcornWithCitedCup)(
    "should give %s (%s) the density of its cited cup, to 3 significant figures",
    (code, _name, foodGroup, citedCupGrams) => {
      expect(densityForLogging(cofidFood(code, foodGroup))).toBe(
        Number((citedCupGrams / US_CUP_ML).toPrecision(3)),
      );
    },
  );

  it.each(peasAndSweetcornWithCitedCup)(
    "should resolve 1 tbsp of %s (%s) to 15 ml at its density",
    (code, _name, foodGroup, citedCupGrams) => {
      const entry = buildLogEntry({
        food: cofidFood(code, foodGroup),
        quantity: 1,
        unit: "portion",
        portion: tablespoon,
        localDate: "2026-10-28",
        loggedAt: "2026-10-28T12:30:00+01:00",
      });

      expect(entry.resolved_grams).toBeCloseTo(
        Number((citedCupGrams / US_CUP_ML).toPrecision(3)) * ML_PER_TBSP,
        10,
      );
    },
  );

  it("should keep sweetcorn weighed with core off the volume measures", () => {
    expect(canMeasureByVolume(cofidFood("13-606", "DG"))).toBe(false);
  });

  it("should keep the other sweetcorn weighed with core off the volume measures", () => {
    expect(canMeasureByVolume(cofidFood("13-623", "DG"))).toBe(false);
  });

  it("should leave a food of the same group with no cited density without one", () => {
    expect(densityForLogging(cofidFood("13-351", "DG"))).toBeNull();
  });
});
