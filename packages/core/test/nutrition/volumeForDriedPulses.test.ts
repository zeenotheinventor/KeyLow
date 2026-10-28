import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { COFID_DENSITY_OVERRIDES } from "../../src/nutrition/density";
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

/** Every dried pulse is in CoFID food group DB, which has no density of its own. */
const DRIED_PULSE_FOOD_GROUP = "DB";

/** A CoFID food as the importer stores it: no density of its own, in the dried pulse food group. */
const cofidFood = (sourceRef: string) =>
  buildFood({
    source: "cofid",
    source_ref: sourceRef,
    food_group: DRIED_PULSE_FOOD_GROUP,
    basis: "per_100g",
    density_g_per_ml: null,
  });

// [CoFID code, name, grams in 1 US cup as USDA FoodData Central SR Legacy weighs it, that cup in millilitres].
// A raw pulse is matched to the SR Legacy "mature seeds, raw" row and a boiled one to the "mature seeds,
// cooked, boiled, without salt" row, so each state carries its own cup weight.
const pulsesWithCitedCup: readonly (readonly [string, string, number, number])[] = [
  ["13-041", "Beans, aduki, whole, dried, raw", 197, US_CUP_ML],
  ["13-042", "Beans, aduki, whole, dried, boiled in unsalted water", 230, US_CUP_ML],
  ["13-056", "Black gram, urad gram, whole, dried, raw", 207, US_CUP_ML],
  ["13-057", "Black gram, urad gram, whole, dried, boiled in unsalted water", 180, US_CUP_ML],
  ["13-062", "Beans, blackeye, whole, dried, raw", 167, US_CUP_ML],
  ["13-063", "Beans, blackeye, whole, dried, boiled in unsalted water", 171, US_CUP_ML],
  ["13-067", "Beans, broad, dried, raw", 150, US_CUP_ML],
  ["13-070", "Beans, butter, dried, raw", 178, US_CUP_ML],
  ["13-663", "Beans, butter, dried, boiled in unsalted water", 188, US_CUP_ML],
  ["13-074", "Beans, chick peas, Kabuli, whole, dried, raw", 200, US_CUP_ML],
  ["13-662", "Beans, chick peas, Kabuli, whole, dried, boiled in unsalted water", 164, US_CUP_ML],
  ["13-086", "Beans, haricot, whole, dried, raw", 208, US_CUP_ML],
  ["13-087", "Beans, haricot, whole, dried, boiled in unsalted water", 182, US_CUP_ML],
  ["13-089", "Lentils, green and brown, whole, dried, raw", 192, US_CUP_ML],
  ["13-661", "Lentils, green and brown, whole, dried, boiled in unsalted water", 198, US_CUP_ML],
  ["13-657", "Lentils, red, split, dried, raw", 192, US_CUP_ML],
  ["13-658", "Lentils, red, split, dried, boiled in unsalted water", 198, US_CUP_ML],
  ["13-096", "Beans, mung, whole, dried, raw", 207, US_CUP_ML],
  ["13-664", "Beans, mung, whole, dried, boiled in unsalted water", 202, US_CUP_ML],
  ["13-102", "Beans, pigeon peas, whole, dried, raw", 205, US_CUP_ML],
  ["13-103", "Beans, pigeon peas, whole, dried, boiled in unsalted water", 168, US_CUP_ML],
  ["13-106", "Beans, pinto, dried, raw", 193, US_CUP_ML],
  ["13-107", "Beans, pinto, dried, boiled in unsalted water", 171, US_CUP_ML],
  ["13-109", "Beans, red kidney, dried, raw", 184, US_CUP_ML],
  ["13-659", "Beans, red kidney, dried, boiled in unsalted water", 177, US_CUP_ML],
  ["13-115", "Beans, soya, dried, raw", 186, US_CUP_ML],
  ["13-116", "Beans, soya, dried, boiled in unsalted water", 172, US_CUP_ML],
];

// [raw CoFID code, boiled CoFID code, pulse]: the same pulse in its two states, each from its own SR Legacy row.
const rawAndBoiledPairs: readonly (readonly [string, string, string])[] = [
  ["13-041", "13-042", "aduki beans"],
  ["13-056", "13-057", "whole black gram"],
  ["13-062", "13-063", "blackeye beans"],
  ["13-070", "13-663", "butter beans"],
  ["13-074", "13-662", "chick peas"],
  ["13-086", "13-087", "haricot beans"],
  ["13-089", "13-661", "green and brown lentils"],
  ["13-657", "13-658", "red lentils"],
  ["13-096", "13-664", "mung beans"],
  ["13-102", "13-103", "pigeon peas"],
  ["13-106", "13-107", "pinto beans"],
  ["13-109", "13-659", "red kidney beans"],
  ["13-115", "13-116", "soya beans"],
];

// The split dahls: SR Legacy has no split black gram, chick pea, mung or pigeon pea row, so they stay without a density.
const splitDahlsWithoutCitedRow: readonly (readonly [string, string])[] = [
  ["13-058", "Black gram, chilki urad dahl, split, dried, raw"],
  ["13-059", "Black gram, chilki urad dahl, dried, split, boiled in unsalted water"],
  ["13-060", "Black gram, duhli urad dahl, split, dried, raw"],
  ["13-061", "Black gram, duhli urad dahl, split, dried, boiled in unsalted water"],
  ["13-076", "Beans, chick peas, Kabuli, split, dried, raw"],
  ["13-077", "Beans, chick peas, Kabuli, split, dried, boiled in unsalted water"],
  ["13-098", "Beans, mung, dahl, dried, raw"],
  ["13-099", "Beans, mung, dahl, dried, boiled in unsalted water"],
  ["13-104", "Beans, pigeon peas, dahl, dried, raw"],
  ["13-105", "Beans, pigeon peas, dahl, dried, boiled in unsalted water"],
];

const citedDensity = (citedGrams: number, measureMl: number) =>
  Number((citedGrams / measureMl).toPrecision(3));

describe("volume measures for dried pulses, raw and boiled", () => {
  it.each(pulsesWithCitedCup)("should let %s (%s) be measured by volume", (code) => {
    expect(canMeasureByVolume(cofidFood(code))).toBe(true);
  });

  it.each(pulsesWithCitedCup)(
    "should give %s (%s) the density of its cited measure, to 3 significant figures",
    (code, _name, citedGrams, measureMl) => {
      expect(densityForLogging(cofidFood(code))).toBe(citedDensity(citedGrams, measureMl));
    },
  );

  it.each(pulsesWithCitedCup)(
    "should resolve 1 tbsp of %s (%s) to 15 ml at its density",
    (code, _name, citedGrams, measureMl) => {
      const entry = buildLogEntry({
        food: cofidFood(code),
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

  it.each(rawAndBoiledPairs)(
    "should give raw %s and boiled %s (%s) different densities, each from its own cited row",
    (rawCode, boiledCode) => {
      expect(densityForLogging(cofidFood(rawCode))).not.toBe(
        densityForLogging(cofidFood(boiledCode)),
      );
    },
  );

  it("should weigh raw red lentils at 192 g a cup and boiled red lentils at 198 g a cup", () => {
    expect(densityForLogging(cofidFood("13-657"))).toBe(0.812);
    expect(densityForLogging(cofidFood("13-658"))).toBe(0.837);
  });

  it("should cite the raw red lentils row for 13-657 and the boiled lentils row for 13-658", () => {
    expect(COFID_DENSITY_OVERRIDES["13-657"]?.source).toContain(
      "FDC 174284 (Lentils, pink or red, raw)",
    );
    expect(COFID_DENSITY_OVERRIDES["13-658"]?.source).toContain(
      "FDC 172421 (Lentils, mature seeds, cooked, boiled, without salt)",
    );
  });

  it.each(splitDahlsWithoutCitedRow)("should keep %s (%s) off the volume measures", (code) => {
    expect(canMeasureByVolume(cofidFood(code))).toBe(false);
  });
});
