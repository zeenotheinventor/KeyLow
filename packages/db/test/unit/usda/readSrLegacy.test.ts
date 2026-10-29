import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../scripts/cofid/checksum";
import {
  SR_LEGACY_ZIP_SHA256,
  readSrLegacy,
  verifyZipChecksum,
} from "../../../scripts/usda/readSrLegacy";

const fixtures = join(import.meta.dirname, "fixtures");

describe("verifyZipChecksum", () => {
  it("should name the published SR Legacy April 2018 zip", () => {
    expect(SR_LEGACY_ZIP_SHA256).toBe(
      "b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0",
    );
  });

  it("should refuse a zip with the wrong checksum, naming both", () => {
    const zipPath = join(mkdtempSync(join(tmpdir(), "usda-zip-")), "sr.zip");
    writeFileSync(zipPath, "not the SR Legacy zip");

    expect(() => {
      verifyZipChecksum(zipPath);
    }).toThrow(new RegExp(`${sha256Hex("not the SR Legacy zip")}.*${SR_LEGACY_ZIP_SHA256}`));
  });

  it("should accept a zip with the expected checksum", () => {
    const zipPath = join(mkdtempSync(join(tmpdir(), "usda-zip-")), "sr.zip");
    writeFileSync(zipPath, "the zip");

    expect(() => {
      verifyZipChecksum(zipPath, sha256Hex("the zip"));
    }).not.toThrow();
  });
});

describe("readSrLegacy", () => {
  it("should read only the listed foods, with nutrients, group and portions", async () => {
    const foods = await readSrLegacy(fixtures, new Set(["172385"]));

    expect([...foods.keys()]).toEqual(["172385"]);
    const thigh = foods.get("172385");
    expect(thigh).toMatchObject({
      fdcId: "172385",
      description: "Chicken, broilers or fryers, thigh, meat and skin, raw",
      foodGroup: "Poultry Products",
    });
    expect(thigh?.nutrients.get(1008)).toBe(221);
    expect(thigh?.nutrients.get(1093)).toBe(81);
    expect(thigh?.portions).toEqual([
      { sequenceNumber: "1", amount: 4, modifier: "oz", grams: 113 },
      { sequenceNumber: "2", amount: 1, modifier: "thigh with skin", grams: 193 },
    ]);
  });

  it("should leave out an id that is not in the folder", async () => {
    const foods = await readSrLegacy(fixtures, new Set(["172385", "999999"]));

    expect([...foods.keys()]).toEqual(["172385"]);
  });

  it("should fail when a nutrient is not in the unit the mapping assumes", async () => {
    const folder = mkdtempSync(join(tmpdir(), "usda-units-"));
    for (const file of ["food.csv", "food_category.csv", "food_nutrient.csv", "food_portion.csv"]) {
      writeFileSync(join(folder, file), "");
    }
    writeFileSync(
      join(folder, "nutrient.csv"),
      '"id","name","unit_name"\n"1093","Sodium, Na","G"\n',
    );

    await expect(readSrLegacy(folder, new Set())).rejects.toThrow(/1093 is in G.*needs MG/);
  });
});
