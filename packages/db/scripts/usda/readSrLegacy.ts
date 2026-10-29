import { createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { sha256Hex } from "../cofid/checksum";
import { parseCsv } from "../cofid/csv";

import type { SrFood } from "./mapSrFood";

/** The sha256 of FoodData_Central_sr_legacy_food_csv_2018-04.zip, the only release the mapping is checked against. */
export const SR_LEGACY_ZIP_SHA256 =
  "b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0";

/** The unit SR gives each nutrient the mapping reads. The mapping assumes these and does not convert. */
const EXPECTED_UNITS: Readonly<Record<number, string>> = {
  1003: "G",
  1004: "G",
  1005: "G",
  1008: "KCAL",
  1079: "G",
  1093: "MG",
  1258: "G",
  2000: "G",
};

export type SrPortion = {
  sequenceNumber: string;
  amount: number;
  modifier: string;
  /** The weight of `amount` units, as SR gives it. */
  grams: number;
};

export type SrRecord = SrFood & { portions: SrPortion[] };

type CsvRecord = Readonly<Record<string, string>>;

/** Refuses a zip that is not the release the mapping was written against. */
export function verifyZipChecksum(zipPath: string, expected: string = SR_LEGACY_ZIP_SHA256): void {
  const actual = sha256Hex(readFileSync(zipPath));
  if (actual !== expected) {
    throw new Error(
      `${zipPath} has sha256 ${actual}, but the SR Legacy April 2018 zip is ${expected}`,
    );
  }
}

/**
 * Streams a CSV one record at a time, so the 36 MB nutrient file is never held whole. A quoted field
 * may hold a line feed, so lines are joined until the quotes balance.
 */
async function* readRecords(path: string): AsyncGenerator<CsvRecord> {
  let header: string[] | undefined;
  let pending = "";
  const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });

  for await (const line of lines) {
    pending = pending === "" ? line : `${pending}\n${line}`;
    if (pending.split('"').length % 2 === 0) {
      continue;
    }
    const [fields] = parseCsv(pending);
    pending = "";
    if (fields === undefined) {
      continue;
    }
    if (header === undefined) {
      header = fields;
    } else {
      const columns = header;
      yield Object.fromEntries(columns.map((column, index) => [column, fields[index] ?? ""]));
    }
  }
  if (pending !== "") {
    throw new Error(`${path} ends inside a quoted field`);
  }
}

function toNumber(text: string, where: string): number {
  const value = Number(text);
  if (text === "" || !Number.isFinite(value)) {
    throw new Error(`${where}: ${JSON.stringify(text)} is not a number`);
  }
  return value;
}

async function checkNutrientUnits(path: string): Promise<void> {
  for await (const nutrient of readRecords(path)) {
    const expected = EXPECTED_UNITS[Number(nutrient["id"])];
    if (expected !== undefined && nutrient["unit_name"] !== expected) {
      throw new Error(
        `SR nutrient ${nutrient["id"]} is in ${nutrient["unit_name"]}, but the mapping needs ${expected}`,
      );
    }
  }
}

async function readCategories(path: string): Promise<Map<string, string>> {
  const categories = new Map<string, string>();
  for await (const category of readRecords(path)) {
    categories.set(category["id"] ?? "", category["description"] ?? "");
  }
  return categories;
}

/**
 * Reads the listed foods from an unpacked SR Legacy CSV folder: food.csv, food_category.csv,
 * nutrient.csv, food_nutrient.csv and food_portion.csv. An id the folder lacks is left out of the result.
 */
export async function readSrLegacy(
  directory: string,
  fdcIds: ReadonlySet<string>,
): Promise<Map<string, SrRecord>> {
  await checkNutrientUnits(join(directory, "nutrient.csv"));
  const categories = await readCategories(join(directory, "food_category.csv"));

  const foods = new Map<string, SrRecord>();
  const nutrientsByFood = new Map<string, Map<number, number>>();
  for await (const food of readRecords(join(directory, "food.csv"))) {
    const fdcId = food["fdc_id"] ?? "";
    if (fdcIds.has(fdcId)) {
      const nutrients = new Map<number, number>();
      nutrientsByFood.set(fdcId, nutrients);
      foods.set(fdcId, {
        fdcId,
        description: food["description"] ?? "",
        foodGroup: categories.get(food["food_category_id"] ?? "") ?? null,
        nutrients,
        portions: [],
      });
    }
  }

  for await (const row of readRecords(join(directory, "food_nutrient.csv"))) {
    const nutrients = nutrientsByFood.get(row["fdc_id"] ?? "");
    if (nutrients === undefined || row["amount"] === "") {
      continue;
    }
    const where = `FDC ${row["fdc_id"]} nutrient ${row["nutrient_id"]}`;
    const nutrientId = toNumber(row["nutrient_id"] ?? "", where);
    if (nutrients.has(nutrientId)) {
      throw new Error(`${where} is listed twice`);
    }
    nutrients.set(nutrientId, toNumber(row["amount"] ?? "", where));
  }

  // A portion with no amount or no weight cannot be used, so it is left out.
  for await (const row of readRecords(join(directory, "food_portion.csv"))) {
    const food = foods.get(row["fdc_id"] ?? "");
    if (food !== undefined && row["amount"] !== "" && row["gram_weight"] !== "") {
      const where = `FDC ${food.fdcId} portion ${row["seq_num"]}`;
      food.portions.push({
        sequenceNumber: row["seq_num"] ?? "",
        amount: toNumber(row["amount"] ?? "", where),
        modifier: row["modifier"] ?? "",
        grams: toNumber(row["gram_weight"] ?? "", where),
      });
    }
  }
  return foods;
}
