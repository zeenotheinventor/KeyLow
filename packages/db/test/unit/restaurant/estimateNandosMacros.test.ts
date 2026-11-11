import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  estimateItem,
  nandosCsvRow,
  parseNandosEstimates,
  readCofidReferences,
  renderNandosCsvRows,
  type ReferenceNutrients,
} from "../../../scripts/restaurant/estimateNandosMacros";
import { parseRestaurantCsv } from "../../../scripts/restaurant/restaurantFoodsCsv";

const dataUrl = (name: string): URL => new URL(`../../../data/${name}`, import.meta.url);
const cofidCsv = readFileSync(dataUrl("cofid/cofid-2021.normalised.csv"), "utf8");
const estimates = parseNandosEstimates(
  readFileSync(dataUrl("restaurants/nandos-estimates.json"), "utf8"),
);
const restaurantRows = parseRestaurantCsv(
  readFileSync(dataUrl("restaurants/restaurant-foods.csv"), "utf8"),
);
const references = readCofidReferences(
  cofidCsv,
  estimates.items.flatMap((item) => item.components.map((component) => component.cofid_code)),
);

const reference = (nutrients: Partial<ReferenceNutrients>): ReferenceNutrients => ({
  kcal: 0,
  protein_g: 0,
  fat_g: 0,
  sat_fat_g: 0,
  carbs_g: 0,
  sugars_g: 0,
  fibre_g: 0,
  salt_g: 0,
  ...nutrients,
});

describe("estimateItem", () => {
  const syntheticReferences = new Map([
    ["a", reference({ kcal: 200, protein_g: 20, fat_g: 10, salt_g: 1 })],
    ["b", reference({ kcal: 100, carbs_g: 25, sugars_g: 5 })],
  ]);
  const item = {
    ref: "nandos-gb:test",
    name: "Test",
    portion_label: "1 test",
    published_kcal: 330,
    ingredients_url: "https://www.nandos.co.uk/allergens/test",
    scale_factor: 1.1,
    components: [
      { name: "Part A", cofid_code: "a", grams: 100 },
      { name: "Part B", cofid_code: "b", grams: 100 },
    ],
  };

  it("should scale every component by one factor so the energy is exactly the published kcal", () => {
    const estimate = estimateItem(item, syntheticReferences);

    expect(estimate.scale_factor).toBeCloseTo(1.1, 10);
    expect(estimate.nutrients.kcal).toBe(330);
  });

  it("should scale the macros by the same factor as the energy", () => {
    const { nutrients } = estimateItem(item, syntheticReferences);

    expect(nutrients.protein_g).toBeCloseTo(22, 10);
    expect(nutrients.fat_g).toBeCloseTo(11, 10);
    expect(nutrients.carbs_g).toBeCloseTo(27.5, 10);
    expect(nutrients.sugars_g).toBeCloseTo(5.5, 10);
    expect(nutrients.salt_g).toBeCloseTo(1.1, 10);
  });

  it("should refuse a component whose reference food is unknown", () => {
    expect(() => estimateItem(item, new Map())).toThrow(/a/);
  });
});

describe("readCofidReferences", () => {
  it("should read a CoFID food per 100 g as the repository maps it", () => {
    const breast = references.get("18-325");

    expect(breast).toMatchObject({ kcal: 173, protein_g: 28.9, fat_g: 6.4 });
  });

  it("should read salt as sodium times 2.5 over 1000", () => {
    expect(references.get("17-367")?.salt_g).toBeCloseTo(98.25, 5);
  });

  it("should fail for a code the CSV does not hold", () => {
    expect(() => readCofidReferences(cofidCsv, ["99-999"])).toThrow(/99-999/);
  });
});

describe("nandos-estimates.json", () => {
  it("should give every food the figures the CSV holds, recomputed from its components", () => {
    for (const item of estimates.items) {
      const row = restaurantRows.find((candidate) => candidate.ref === item.ref);

      expect(row, item.ref).toBeDefined();
      expect(row, item.ref).toEqual(nandosCsvRow(item, estimates, references));
    }
  });

  it("should hold the scale factor that the components work out to, to four decimals", () => {
    for (const item of estimates.items) {
      expect(item.scale_factor, item.ref).toBeCloseTo(
        estimateItem(item, references).scale_factor,
        4,
      );
    }
  });

  it("should keep every unscaled estimate within 15% of the published energy, so the weights are sensible", () => {
    for (const item of estimates.items) {
      expect(Math.abs(item.scale_factor - 1), item.ref).toBeLessThanOrEqual(0.15);
    }
  });

  it("should cover every Nando's row of the CSV, and only those", () => {
    const csvRefs = restaurantRows.filter((row) => row.chain === "Nando's").map((row) => row.ref);

    expect(estimates.items.map((item) => item.ref).sort()).toEqual(csvRefs.sort());
  });

  it("should store each food per portion with the published energy as its kcal", () => {
    for (const item of estimates.items) {
      const row = restaurantRows.find((candidate) => candidate.ref === item.ref);

      expect(row?.kcal, item.ref).toBe(item.published_kcal);
      expect(row?.weight_basis, item.ref).toBe("none");
      expect(row?.portion_grams, item.ref).toBeNull();
    }
  });

  it("should name a Nando's UK page for the energy and one for the ingredients of every food", () => {
    for (const item of estimates.items) {
      expect(new URL(estimates.kcal_source_url).hostname).toBe("www.nandos.co.uk");
      expect(new URL(item.ingredients_url).hostname, item.ref).toBe("www.nandos.co.uk");
    }
  });
});

describe("renderNandosCsvRows", () => {
  it("should write the lines the CSV holds for Nando's, so the CSV can be regenerated from the estimates", () => {
    const csv = readFileSync(dataUrl("restaurants/restaurant-foods.csv"), "utf8");
    const nandosLines = csv.split("\n").filter((line) => line.includes(",Nando's,"));

    expect(renderNandosCsvRows(estimates, references).trimEnd().split("\n")).toEqual(nandosLines);
  });
});
