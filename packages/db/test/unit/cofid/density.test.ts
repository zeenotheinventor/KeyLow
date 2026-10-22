import { readFileSync } from "node:fs";

import { COFID_DENSITY_OVERRIDES, COFID_GROUP_DENSITIES, estimateDensity } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/cofid/csv";

import type { Food } from "@keylow/core";

type DensityFood = Pick<Food, "source" | "source_ref" | "food_group" | "density_g_per_ml">;

const [header = [], ...rows] = parseCsv(
  readFileSync(new URL("../../../data/cofid/cofid-2021.normalised.csv", import.meta.url), "utf8"),
);
const codeColumn = header.indexOf("food_code");
const groupColumn = header.indexOf("food_group");
const nameColumn = header.indexOf("food_name");

const cofidFoodGroups = [...new Set(rows.map((row) => row[groupColumn] ?? ""))].sort();

/** A CoFID food as the importer stores it: no density of its own, the CoFID group code as its group. */
const cofidFoodByCode = (code: string): DensityFood => {
  const row = rows.find((candidate) => candidate[codeColumn] === code);
  if (row === undefined) {
    throw new Error(`CoFID food ${code} is not in the normalised CSV`);
  }
  return {
    source: "cofid",
    source_ref: code,
    food_group: row[groupColumn] ?? null,
    density_g_per_ml: null,
  };
};

describe("the CoFID group density table against the real CSV", () => {
  it("should find the columns it reads", () => {
    expect(codeColumn).toBeGreaterThanOrEqual(0);
    expect(groupColumn).toBeGreaterThanOrEqual(0);
  });

  it("should classify every food group in the CSV", () => {
    const unclassified = cofidFoodGroups.filter(
      (group) => !Object.hasOwn(COFID_GROUP_DENSITIES, group),
    );

    expect(unclassified, `unclassified CoFID food groups: ${unclassified.join(", ")}`).toEqual([]);
  });

  it("should not list a group that no food in the CSV uses", () => {
    const unused = Object.keys(COFID_GROUP_DENSITIES).filter(
      (group) => !cofidFoodGroups.includes(group),
    );

    expect(unused, `listed groups with no food: ${unused.join(", ")}`).toEqual([]);
  });
});

describe("the CoFID per-food density overrides against the real CSV", () => {
  const csvCodes = new Set(rows.map((row) => row[codeColumn]));

  it("should only key an override by a food code that is in the CSV", () => {
    const unknown = Object.keys(COFID_DENSITY_OVERRIDES).filter((code) => !csvCodes.has(code));

    expect(unknown, `override codes not in the CoFID CSV: ${unknown.join(", ")}`).toEqual([]);
  });

  it.each([
    ["13-830", "Garlic powder"],
    ["13-880", "Pepper, black"],
    ["13-881", "Pepper, white"],
    ["13-879", "Paprika"],
    ["13-873", "Chilli powder"],
    ["13-874", "Cinnamon, ground"],
    ["13-861", "Turmeric, ground"],
    ["13-832", "Ginger, ground"],
    ["13-889", "Cumin seeds"],
    ["13-876", "Curry powder"],
    ["13-878", "Oregano, dried, ground"],
    ["17-367", "Salt"],
    ["17-356", "Bicarbonate of soda"],
    ["17-355", "Baking powder"],
  ])("should give %s (%s) a cited density, so tsp and tbsp appear", (code, name) => {
    const row = rows.find((candidate) => candidate[codeColumn] === code);

    expect(row?.[nameColumn]).toBe(name);
    expect(estimateDensity(cofidFoodByCode(code))?.basis).toBe("override");
  });

  it.each([
    ["13-884", "mixed herbs, dried, a recipe of four herbs with no USDA twin"],
    ["13-891", "oregano, fresh, which USDA does not weigh by the spoon"],
  ])("should leave %s (%s) without a density", (code) => {
    expect(estimateDensity(cofidFoodByCode(code))).toBeNull();
  });
});

describe("estimateDensity on real CoFID foods", () => {
  it("should give olive oil (17-038, group OC) a density from its group", () => {
    expect(estimateDensity(cofidFoodByCode("17-038"))).toEqual({ gPerMl: 0.92, basis: "group" });
  });

  it("should give semi-skimmed milk (12-313, group BAH) a density from its group", () => {
    expect(estimateDensity(cofidFoodByCode("12-313"))).toEqual({ gPerMl: 1.03, basis: "group" });
  });

  it("should give honey (17-050) its override, not the sugars group", () => {
    expect(estimateDensity(cofidFoodByCode("17-050"))).toEqual({
      gPerMl: 1.42,
      basis: "override",
    });
  });

  it.each([
    ["11-886", "plain flour", 0.51],
    ["11-887", "strong white flour", 0.51],
    ["11-888", "self raising flour", 0.48],
    ["11-889", "wholemeal flour", 0.48],
    ["11-890", "strong wholemeal flour", 0.48],
    ["11-891", "wholemeal self raising flour", 0.48],
    ["17-063", "white sugar", 0.84],
    ["17-060", "brown sugar", 0.9],
    ["17-061", "Demerara sugar", 0.93],
    ["17-062", "icing sugar", 0.48],
    ["17-661", "unsalted butter", 0.96],
    ["17-685", "salted butter", 0.96],
  ])("should give %s (%s) an override", (code, _name, gPerMl) => {
    expect(estimateDensity(cofidFoodByCode(code))).toEqual({ gPerMl, basis: "override" });
  });

  it.each([
    ["11-892", "brown flour"],
    ["11-893", "strong brown flour"],
  ])("should leave %s (%s) without a density, as no chart entry matches it", (code) => {
    expect(estimateDensity(cofidFoodByCode(code))).toBeNull();
  });

  it("should give Irish coffee (17-594) the infusion group density", () => {
    expect(estimateDensity(cofidFoodByCode("17-594"))).toEqual({ gPerMl: 1, basis: "group" });
  });

  it.each([
    ["14-318", "bananas"],
    ["18-323", "grilled chicken breast"],
  ])("should give %s (%s) no density, so no volume measure is offered", (code) => {
    expect(estimateDensity(cofidFoodByCode(code))).toBeNull();
  });
});
