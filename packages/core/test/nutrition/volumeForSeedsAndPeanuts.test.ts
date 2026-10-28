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

// The US measures USDA FoodData Central weighs its household portions in, in millilitres.
const US_CUP_ML = 236.588;
const US_TBSP_ML = 14.7868;

/** A CoFID food as the importer stores it: no density of its own, in the given CoFID food group. */
const cofidFood = (sourceRef: string, foodGroup: string) =>
  buildFood({
    source: "cofid",
    source_ref: sourceRef,
    food_group: foodGroup,
    basis: "per_100g",
    density_g_per_ml: null,
  });

// [CoFID code, name, CoFID food group, grams in 1 US measure as USDA FoodData Central SR Legacy weighs it, that measure in millilitres]
const seedsAndPeanutsWithCitedMeasure: readonly (readonly [
  string,
  string,
  string,
  number,
  number,
])[] = [
  ["14-842", "Pumpkin seeds", "GA", 129, US_CUP_ML],
  ["14-844", "Sesame seeds", "GA", 144, US_CUP_ML],
  ["14-845", "Sunflower seeds", "GA", 140, US_CUP_ML],
  ["14-846", "Sunflower seeds, toasted", "GA", 134, US_CUP_ML],
  ["14-826", "Melon seeds", "GA", 108, US_CUP_ML],
  ["14-895", "Breadnut seeds, dried", "G", 160, US_CUP_ML],
  ["14-843", "Quinoa, raw", "GA", 170, US_CUP_ML],
  ["14-847", "Tahini paste", "GA", 15, US_TBSP_ML],
  ["14-877", "Peanuts, kernel only, plain, unsalted", "GA", 146, US_CUP_ML],
  ["14-834", "Peanuts, roasted and salted", "GA", 144, US_CUP_ML],
  ["14-878", "Peanuts, dry roasted", "GA", 146, US_CUP_ML],
];

const citedDensity = (citedGrams: number, measureMl: number) =>
  Number((citedGrams / measureMl).toPrecision(3));

describe("volume measures for seeds, peanuts, quinoa and tahini", () => {
  it.each(seedsAndPeanutsWithCitedMeasure)(
    "should let %s (%s) be measured by volume",
    (code, _name, foodGroup) => {
      expect(canMeasureByVolume(cofidFood(code, foodGroup))).toBe(true);
    },
  );

  it.each(seedsAndPeanutsWithCitedMeasure)(
    "should give %s (%s) the density of its cited measure, to 3 significant figures",
    (code, _name, foodGroup, citedGrams, measureMl) => {
      expect(densityForLogging(cofidFood(code, foodGroup))).toBe(
        citedDensity(citedGrams, measureMl),
      );
    },
  );

  it.each(seedsAndPeanutsWithCitedMeasure)(
    "should resolve 1 tbsp of %s (%s) to 15 ml at its density",
    (code, _name, foodGroup, citedGrams, measureMl) => {
      const entry = buildLogEntry({
        food: cofidFood(code, foodGroup),
        quantity: 1,
        unit: "portion",
        portion: tablespoon,
        localDate: "2026-10-28",
        loggedAt: "2026-10-28T12:30:00+01:00",
      });

      expect(entry.resolved_grams).toBeCloseTo(
        citedDensity(citedGrams, measureMl) * ML_PER_TBSP,
        10,
      );
    },
  );

  it("should keep peanuts weighed with shells off the volume measures", () => {
    expect(canMeasureByVolume(cofidFood("14-886", "GA"))).toBe(false);
  });
});
