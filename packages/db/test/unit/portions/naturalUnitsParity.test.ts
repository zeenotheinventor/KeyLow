import { readFileSync } from "node:fs";

import { NATURAL_UNIT_TYPES } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { parseCsv } from "../../../scripts/cofid/csv";

const dataDirectory = new URL("../../../data/", import.meta.url);

/** Each row of a CSV file as an object keyed by its header. */
function readRecords(relativePath: string): Record<string, string>[] {
  const [header = [], ...rows] = parseCsv(
    readFileSync(new URL(relativePath, dataDirectory), "utf8"),
  );
  return rows.map((cells) =>
    Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""])),
  );
}

const portionRecords = readRecords("portions/cofid-portions.csv");
const cofidRecords = readRecords("cofid/cofid-2021.normalised.csv");

describe("borrowed natural units against the cited files", () => {
  describe.each(NATURAL_UNIT_TYPES)("$type ($cofidFoodCode)", (entry) => {
    it("should have the labels, grams and default of its rows in cofid-portions.csv, in order", () => {
      const cited = portionRecords
        .filter((record) => record["food_code"] === entry.cofidFoodCode)
        .sort((first, second) => Number(first["position"]) - Number(second["position"]))
        .map((record) => ({
          label: record["label"],
          grams: Number(record["grams"]),
          isDefault: record["is_default"] === "true",
        }));

      expect(cited.length).toBeGreaterThan(0);
      expect(entry.portions).toEqual(cited);
    });

    it("should name the FDC id its rows cite", () => {
      const fdcIds = new Set(
        portionRecords
          .filter((record) => record["food_code"] === entry.cofidFoodCode)
          .map((record) => record["fdc_id"]),
      );

      expect([...fdcIds]).toHaveLength(1);
      expect(entry.source).toContain(`FDC id ${[...fdcIds].join("")},`);
    });

    it("should have the CoFID energy of its food code as the reference kcal", () => {
      const food = cofidRecords.find((record) => record["food_code"] === entry.cofidFoodCode);

      expect(food?.["proximates_energy_kcal_kcal"]).toBe(String(entry.referenceKcalPer100g));
    });
  });
});
