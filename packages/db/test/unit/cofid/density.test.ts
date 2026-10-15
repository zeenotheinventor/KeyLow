import { readFileSync } from "node:fs";

import { COFID_GROUP_DENSITIES, estimateDensity } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/cofid/csv";

import type { Food } from "@keylow/core";

type DensityFood = Pick<Food, "source" | "source_ref" | "food_group" | "density_g_per_ml">;

const [header = [], ...rows] = parseCsv(
  readFileSync(new URL("../../../data/cofid/cofid-2021.normalised.csv", import.meta.url), "utf8"),
);
const codeColumn = header.indexOf("food_code");
const groupColumn = header.indexOf("food_group");

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
    ["11-888", "self raising flour", 0.48],
    ["11-889", "wholemeal flour", 0.48],
  ])("should give %s (%s) an override", (code, _name, gPerMl) => {
    expect(estimateDensity(cofidFoodByCode(code))).toEqual({ gPerMl, basis: "override" });
  });

  it.each([
    ["14-318", "bananas"],
    ["18-323", "grilled chicken breast"],
  ])("should give %s (%s) no density, so no volume measure is offered", (code) => {
    expect(estimateDensity(cofidFoodByCode(code))).toBeNull();
  });
});
