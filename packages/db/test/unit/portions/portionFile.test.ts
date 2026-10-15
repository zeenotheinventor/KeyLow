import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/cofid/csv";
import { parseSubsetFile } from "../../../scripts/cofid/subset";

const readPackageFile = (path: string): string =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

/** A file row with every column by name, including the ones that only cite the source. */
type FileRow = Record<string, string>;

function readRows(text: string): FileRow[] {
  const [header = [], ...body] = parseCsv(text);
  return body.map((cells) =>
    Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""])),
  );
}

const portionsPath = "data/portions/cofid-portions.csv";
const rows = readRows(readPackageFile(portionsPath));

const isWholeNumberAbove = (text: string | undefined, minimum: number): boolean =>
  text !== undefined && /^\d+$/.test(text) && Number(text) > minimum;

/** Rows grouped by `food_code`, for the rules that hold per food. */
const rowsByFood = new Map<string, FileRow[]>();
for (const row of rows) {
  const foodCode = row["food_code"] ?? "";
  rowsByFood.set(foodCode, [...(rowsByFood.get(foodCode) ?? []), row]);
}

describe("the committed portions file", () => {
  it("should have rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows.map((row) => [`${row["food_code"]} ${row["label"]}`, row] as const))(
    "should cite its source and give one weight: %s",
    (_name, row) => {
      expect(row["food_code"]).toMatch(/^\d{2}-\d+$/);
      expect(row["label"]?.trim()).toBeTruthy();
      expect(row["weight_basis"]?.trim()).toBeTruthy();
      expect(isWholeNumberAbove(row["fdc_id"], 0)).toBe(true);
      expect(row["fdc_description"]?.trim()).toBeTruthy();
      expect(row["source"]).toContain("USDA FoodData Central");
      expect(row["source"]).toContain(`FDC id ${row["fdc_id"]}`);

      const weights = [row["grams"], row["ml"]].filter((weight) => weight !== "");
      expect(weights).toHaveLength(1);
      expect(Number(weights[0])).toBeGreaterThan(0);

      expect(row["label"]).not.toContain("(");
      expect(row["is_default"]).toMatch(/^(true|false)$/);
    },
  );

  it("should list no label twice for a food", () => {
    const keys = rows.map((row) => `${row["food_code"]}|${row["label"]}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("should give each food at most one default", () => {
    for (const [foodCode, foodRows] of rowsByFood) {
      const defaults = foodRows.filter((row) => row["is_default"] === "true");
      expect(defaults.length, `food ${foodCode}`).toBeLessThanOrEqual(1);
    }
  });

  it("should give each portion of a food its own position", () => {
    for (const [foodCode, foodRows] of rowsByFood) {
      const positions = foodRows.map((row) => row["position"]);
      expect(new Set(positions).size, `food ${foodCode}`).toBe(positions.length);
    }
  });

  it("should cover Zee's two examples: the banana and the chicken thigh", () => {
    const labelsOf = (foodCode: string): (string | undefined)[] =>
      (rowsByFood.get(foodCode) ?? []).map((row) => row["label"]);

    expect(labelsOf("14-318")).toContain("1 medium");
    expect(labelsOf("18-317")).toContain("1 thigh");
  });

  it("should open the banana on 1 medium and the thigh on 1 thigh", () => {
    const defaultLabelOf = (foodCode: string): string | undefined =>
      rowsByFood.get(foodCode)?.find((row) => row["is_default"] === "true")?.["label"];

    expect(defaultLabelOf("14-318")).toBe("1 medium");
    expect(defaultLabelOf("18-317")).toBe("1 thigh");
  });
});

describe("the committed portions file against the CoFID data", () => {
  const cofidFoods = new Map(
    readRows(readPackageFile("data/cofid/cofid-2021.normalised.csv")).map((row) => [
      row["food_code"] ?? "",
      row["food_name"] ?? "",
    ]),
  );
  const subsetCodes = new Set(parseSubsetFile(readPackageFile("data/cofid/subset.txt")));

  it("should name only foods that are in the full CoFID data", () => {
    const unknownCodes = [...rowsByFood.keys()].filter((foodCode) => !cofidFoods.has(foodCode));

    expect(unknownCodes).toEqual([]);
  });

  it("should name only foods that are in the local seed subset, so the seed needs no regeneration", () => {
    const codesOutsideSubset = [...rowsByFood.keys()].filter(
      (foodCode) => !subsetCodes.has(foodCode),
    );

    expect(codesOutsideSubset).toEqual([]);
  });

  it("should state the weight basis the CoFID food name states", () => {
    const statedBases = [
      "flesh only",
      "flesh and skin",
      "meat and skin",
      "meat only",
      "weighed with bone",
      "weighed with skin",
    ];

    for (const [foodCode, foodRows] of rowsByFood) {
      const foodName = cofidFoods.get(foodCode) ?? "";
      for (const basis of statedBases.filter((statedBasis) => foodName.includes(statedBasis))) {
        for (const row of foodRows) {
          expect(row["weight_basis"], `${foodCode} ${foodName}`).toContain(basis);
        }
      }
    }
  });
});
