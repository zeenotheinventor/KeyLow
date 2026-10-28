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

// [CoFID code, name, CoFID food group, grams in 1 US cup as USDA FoodData Central SR Legacy weighs it, that cup in millilitres]
const nutsAndCoconutWithCitedCup: readonly (readonly [string, string, string, number, number])[] = [
  ["14-896", "Almonds, whole kernels", "GA", 143, US_CUP_ML],
  ["14-897", "Almonds, toasted", "GA", 138, US_CUP_ML],
  ["14-870", "Almonds, flaked and ground", "GA", 95, US_CUP_ML],
  ["14-871", "Brazil nuts, kernel only", "GA", 133, US_CUP_ML],
  ["14-812", "Cashew nuts, kernel only, roasted and salted", "GA", 129, US_CUP_ML],
  ["14-874", "Hazelnuts, kernel only", "GA", 135, US_CUP_ML],
  ["14-804", "Barcelona nuts, Kernel only", "GA", 135, US_CUP_ML],
  ["14-879", "Walnuts, kernel only", "GA", 100, US_CUP_ML],
  ["14-837", "Pecan nuts, kernel only", "GA", 99, US_CUP_ML],
  ["14-839", "Pine nuts, kernel only", "GA", 135, US_CUP_ML],
  ["14-840", "Pistachio nuts, kernel only, roasted and salted", "GA", 123, US_CUP_ML],
  ["14-891", "Macadamia nuts, salted", "G", 132, US_CUP_ML],
  ["14-849", "Trail mix", "GA", 150, US_CUP_ML],
  ["14-813", "Chestnuts, kernel only, raw", "GA", 145, US_CUP_ML],
  ["14-816", "Coconut, flesh only, fresh", "GA", 80, US_CUP_ML],
  ["14-873", "Coconut, desiccated", "GA", 93, US_CUP_ML],
  ["14-820", "Coconut milk", "GA", 240, US_CUP_ML],
  ["14-889", "Coconut milk, retail", "GA", 226, US_CUP_ML],
];

// The foods CoFID weighs with their shells: the grams include what is not eaten, so they have no density.
const weighedWithShells: readonly (readonly [string, string])[] = [
  ["14-805", "Barcelona nuts, kernel only, weighed with shells"],
  ["14-814", "Chestnuts, kernel only, raw, weighed with shells"],
  ["14-838", "Pecan nuts, kernel only, weighed with shells"],
  ["14-841", "Pistachio nuts, kernel only, roasted and salted, weighed with shells"],
  ["14-884", "Brazil nuts, kernel only, weighed with shells"],
  ["14-885", "Hazelnuts, kernel only, weighed with shells"],
  ["14-887", "Walnuts, kernel only, weighed with shells"],
  ["14-898", "Almonds, weighed with shells"],
];

const citedDensity = (citedGrams: number, measureMl: number) =>
  Number((citedGrams / measureMl).toPrecision(3));

describe("volume measures for tree nuts, coconut and trail mix", () => {
  it.each(nutsAndCoconutWithCitedCup)(
    "should let %s (%s) be measured by volume",
    (code, _name, foodGroup) => {
      expect(canMeasureByVolume(cofidFood(code, foodGroup))).toBe(true);
    },
  );

  it.each(nutsAndCoconutWithCitedCup)(
    "should give %s (%s) the density of its cited measure, to 3 significant figures",
    (code, _name, foodGroup, citedGrams, measureMl) => {
      expect(densityForLogging(cofidFood(code, foodGroup))).toBe(
        citedDensity(citedGrams, measureMl),
      );
    },
  );

  it.each(nutsAndCoconutWithCitedCup)(
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

  it.each(weighedWithShells)("should keep %s (%s) off the volume measures", (code) => {
    expect(canMeasureByVolume(cofidFood(code, "GA"))).toBe(false);
  });
});
