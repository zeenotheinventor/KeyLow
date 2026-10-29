import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { parseCuratedList } from "./curatedList";
import { mapSrFood } from "./mapSrFood";
import { readSrLegacy, verifyZipChecksum } from "./readSrLegacy";
import { formatChecksumFile, sha256Hex } from "../cofid/checksum";
import { formatCsv } from "../cofid/csv";

import type { CuratedFood } from "./curatedList";
import type { SrPortion, SrRecord } from "./readSrLegacy";

export const NORMALISED_COLUMNS = [
  "fdc_id",
  "name",
  "sr_description",
  "food_group",
  "basis",
  "kcal",
  "protein_g",
  "fat_g",
  "sat_fat_g",
  "carbs_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
  "micros",
  "quality",
  "portion_label",
  "portion_amount",
  "portion_grams",
  "portion_modifier",
] as const;

export type NormalisedUsda = {
  csv: string;
  sha256: string;
  summary: { foodCount: number; portionCount: number };
};

const cellOf = (value: number | string | null): string => (value === null ? "" : String(value));

function findSrFood(curated: CuratedFood, records: ReadonlyMap<string, SrRecord>): SrRecord {
  const record = records.get(curated.fdcId);
  if (record === undefined) {
    throw new Error(`FDC ${curated.fdcId} is not in the SR Legacy folder`);
  }
  if (record.description !== curated.srDescription) {
    throw new Error(
      `FDC ${curated.fdcId}: the list says ${JSON.stringify(curated.srDescription)}, but SR Legacy says ${JSON.stringify(record.description)}`,
    );
  }
  return record;
}

function findPortion(curated: CuratedFood, record: SrRecord): SrPortion | null {
  if (curated.portion === null) {
    return null;
  }
  const { sequenceNumber } = curated.portion;
  const portion = record.portions.find((candidate) => candidate.sequenceNumber === sequenceNumber);
  if (portion === undefined) {
    throw new Error(`FDC ${curated.fdcId} has no usable SR portion with seq_num ${sequenceNumber}`);
  }
  if (portion.amount !== 1) {
    throw new Error(
      `FDC ${curated.fdcId} portion seq_num ${sequenceNumber}: the SR amount is ${portion.amount}, but a natural portion must be for exactly 1`,
    );
  }
  return portion;
}

function rowFor(curated: CuratedFood, record: SrRecord): { cells: string[]; hasPortion: boolean } {
  const food = mapSrFood(record, curated.name);
  const portion = findPortion(curated, record);

  return {
    hasPortion: portion !== null,
    cells: [
      record.fdcId,
      food.name,
      record.description,
      cellOf(food.food_group),
      food.basis,
      cellOf(food.kcal),
      cellOf(food.protein_g),
      cellOf(food.fat_g),
      cellOf(food.sat_fat_g),
      cellOf(food.carbs_g),
      cellOf(food.sugars_g),
      cellOf(food.fibre_g),
      cellOf(food.salt_g),
      JSON.stringify(food.micros),
      JSON.stringify(food.quality),
      cellOf(curated.portion?.label ?? null),
      cellOf(portion?.amount ?? null),
      cellOf(portion?.grams ?? null),
      cellOf(portion?.modifier ?? null),
    ],
  };
}

/** Maps every food in the curated list and writes the deterministic CSV: one row per food, in list order. */
export async function normaliseUsda(input: {
  srDirectory: string;
  curatedCsv: string;
}): Promise<NormalisedUsda> {
  const curatedFoods = parseCuratedList(input.curatedCsv);
  const records = await readSrLegacy(
    input.srDirectory,
    new Set(curatedFoods.map(({ fdcId }) => fdcId)),
  );

  const rows = curatedFoods.map((curated) => rowFor(curated, findSrFood(curated, records)));
  const csv = formatCsv([[...NORMALISED_COLUMNS], ...rows.map(({ cells }) => cells)]);

  return {
    csv,
    sha256: sha256Hex(csv),
    summary: {
      foodCount: rows.length,
      portionCount: rows.filter(({ hasPortion }) => hasPortion).length,
    },
  };
}

/** Normalises the curated list and writes the CSV and its .sha256 file. A wrong zip checksum writes nothing. */
export async function runNormalise(options: {
  srDirectory: string;
  listPath: string;
  outputPath: string;
  zipPath?: string;
}): Promise<NormalisedUsda> {
  const { srDirectory, listPath, outputPath, zipPath } = options;
  if (zipPath !== undefined) {
    verifyZipChecksum(zipPath);
  }
  const result = await normaliseUsda({
    srDirectory,
    curatedCsv: readFileSync(listPath, "utf8"),
  });

  writeFileSync(outputPath, result.csv);
  writeFileSync(`${outputPath}.sha256`, formatChecksumFile(result.sha256, basename(outputPath)));
  return result;
}
