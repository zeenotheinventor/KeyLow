import { sha256Hex } from "../cofid/checksum";
import { parseCsv } from "../cofid/csv";
import { sqlLiteral } from "../cofid/sqlLiteral";
import { portionId } from "../portions/portionId";
import { uuidV5 } from "../uuidV5";
import { NORMALISED_COLUMNS } from "./normalise";
import { USDA_ID_NAMESPACE, usdaFoodId } from "./usdaFoodId";

type Column = (typeof NORMALISED_COLUMNS)[number];
type CellValue = string | number | null | Record<string, unknown>;
type NormalisedRow = Readonly<Record<string, CellValue>>;

const IMPORT_RUN_LABEL = "usda-sr-2018-04";

const NUMBER_COLUMNS: ReadonlySet<Column> = new Set([
  "kcal",
  "protein_g",
  "fat_g",
  "sat_fat_g",
  "carbs_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
  "portion_amount",
  "portion_grams",
]);
const JSON_COLUMNS: ReadonlySet<Column> = new Set(["micros", "quality"]);
const OPTIONAL_TEXT_COLUMNS: ReadonlySet<Column> = new Set([
  "food_group",
  "portion_label",
  "portion_modifier",
]);

/** The `foods` columns the migration inserts. brand, barcode, density and fetched_at stay null, and deleted_at is never written. */
const FOOD_COLUMNS = [
  "id",
  "source",
  "source_ref",
  "owner_id",
  "name",
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
  "food_group",
] as const;
const UPDATED_FOOD_COLUMNS = FOOD_COLUMNS.filter(
  (column) => !["id", "source", "source_ref", "owner_id"].includes(column),
);

function parseCell(column: Column, text: string): CellValue {
  if (NUMBER_COLUMNS.has(column)) {
    if (text === "") {
      return null;
    }
    const value = Number(text);
    if (!Number.isFinite(value)) {
      throw new Error(`${column} ${JSON.stringify(text)} is not a number`);
    }
    return value;
  }
  if (JSON_COLUMNS.has(column)) {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${column} is not a JSON object`);
    }
    return Object.fromEntries(Object.entries(value));
  }
  return OPTIONAL_TEXT_COLUMNS.has(column) && text === "" ? null : text;
}

function parseRow(fields: readonly string[], rowNumber: number): NormalisedRow {
  if (fields.length !== NORMALISED_COLUMNS.length) {
    throw new Error(
      `CSV row ${rowNumber} has ${fields.length} fields for ${NORMALISED_COLUMNS.length} columns`,
    );
  }
  const fdcId = fields[0] ?? "";
  try {
    return Object.fromEntries(
      NORMALISED_COLUMNS.map((column, index) => [column, parseCell(column, fields[index] ?? "")]),
    );
  } catch (error) {
    throw new Error(`FDC ${fdcId}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function parseNormalisedCsv(csv: string): NormalisedRow[] {
  const [header, ...records] = parseCsv(csv);
  if (header?.join(",") !== NORMALISED_COLUMNS.join(",")) {
    throw new Error(
      `The normalised USDA CSV needs these columns, in this order: ${NORMALISED_COLUMNS.join(", ")}`,
    );
  }
  // Row 1 is the header.
  return records.map((fields, index) => parseRow(fields, index + 2));
}

const updateAll = (columns: readonly string[]): string =>
  columns.map((column) => `${column} = excluded.${column}`).join(", ");

const cellOf = (row: NormalisedRow, column: Column): CellValue => row[column] ?? null;
function textOf(row: NormalisedRow, column: Column): string {
  const value = cellOf(row, column);
  if (typeof value !== "string") {
    throw new Error(`FDC ${JSON.stringify(row["fdc_id"])}: ${column} is not text`);
  }
  return value;
}

function insertRunStatement(runId: string, sha256: string, foodCount: number): string {
  return [
    "insert into public.import_runs (id, source, label, file_sha256, started_at, finished_at, row_count)",
    `values (${[sqlLiteral(runId), "'usda'", sqlLiteral(IMPORT_RUN_LABEL), sqlLiteral(sha256), "now()", "now()", sqlLiteral(foodCount)].join(", ")})`,
    "on conflict (id) do nothing;",
  ].join(" ");
}

function insertFoodStatement(row: NormalisedRow): string {
  const fdcId = textOf(row, "fdc_id");
  const values = FOOD_COLUMNS.map((column) => {
    switch (column) {
      case "id":
        return sqlLiteral(usdaFoodId(fdcId));
      case "source":
        return "'usda'";
      case "source_ref":
        return sqlLiteral(fdcId);
      case "owner_id":
        return "null";
      default:
        return sqlLiteral(cellOf(row, column));
    }
  });
  return `insert into public.foods (${FOOD_COLUMNS.join(", ")}) values (${values.join(", ")}) on conflict (source, source_ref) do update set ${updateAll(UPDATED_FOOD_COLUMNS)};`;
}

const insertSourceDataStatement = (row: NormalisedRow, runId: string): string =>
  `insert into public.food_source_data (food_id, import_run_id, raw) values (${sqlLiteral(usdaFoodId(textOf(row, "fdc_id")))}, ${sqlLiteral(runId)}, ${sqlLiteral(row)}) on conflict (food_id) do update set import_run_id = excluded.import_run_id, raw = excluded.raw;`;

/** The statements for the one natural portion of a food, or none when the CSV row has no portion. */
function portionStatements(row: NormalisedRow): string[] {
  if (cellOf(row, "portion_label") === null) {
    return [];
  }
  const label = textOf(row, "portion_label");
  const grams = cellOf(row, "portion_grams");
  if (typeof grams !== "number" || grams <= 0) {
    throw new Error(`FDC ${textOf(row, "fdc_id")}: the portion ${label} has no weight`);
  }
  const fdcId = textOf(row, "fdc_id");
  const foodId = sqlLiteral(usdaFoodId(fdcId));
  const id = sqlLiteral(portionId(`usda:${fdcId}`, label));
  return [
    // Clears the old default of the food first, so the one-default-per-food index never sees two.
    `update public.food_portions set is_default = false where food_id = ${foodId} and owner_id is null and is_default and id <> ${id};`,
    `insert into public.food_portions (id, food_id, owner_id, label, grams, is_default, position) values (${[id, foodId, "null", sqlLiteral(label), sqlLiteral(grams), "true", "0"].join(", ")}) on conflict (id) do update set grams = excluded.grams, is_default = excluded.is_default, position = excluded.position where public.food_portions.owner_id is null;`,
  ];
}

/**
 * The USDA foods as an idempotent SQL migration, so any database, production included, gets them when
 * Deploy Supabase applies it. Unlike the CoFID portions migration it inserts its own rows, because USDA
 * foods exist nowhere else. A food is upserted on `(source, source_ref)` under an id made from its FDC
 * id, so its portion can name it directly. It only adds and updates: no food, portion or source data is
 * ever deleted, and `deleted_at` is never touched. It has no begin or commit, because the migration
 * runner owns the transaction. The text depends only on the CSV, in the order the CSV lists the foods.
 */
export function renderUsdaMigration(csv: string): string {
  const rows = parseNormalisedCsv(csv);
  const sha256 = sha256Hex(csv);
  const runId = uuidV5(USDA_ID_NAMESPACE, `import-run:${sha256}`);

  return `${[
    "-- Generated by packages/db/scripts/import-usda.ts from data/usda/usda-sr-legacy.normalised.csv. Do not edit by hand.",
    "-- Regenerate with: pnpm --filter @keylow/db import:usda emit-migration --csv data/usda/usda-sr-legacy.normalised.csv --out supabase/migrations/<timestamp>_usda_foods.sql",
    "-- A change to the CSV is a new generated migration with a later timestamp, and an applied migration is never edited. Every statement is idempotent.",
    "-- USDA foods exist in no other migration or seed, so this one inserts the foods and their portions itself, and it never deletes one.",
    // No `set local standard_conforming_strings`: the CLI runs a migration outside a transaction block, so it would only warn.
    "-- The literals leave backslashes alone, which is right while standard_conforming_strings is on, the server default.",
    insertRunStatement(runId, sha256, rows.length),
    ...rows.flatMap((row) => [
      insertFoodStatement(row),
      insertSourceDataStatement(row, runId),
      ...portionStatements(row),
    ]),
  ].join("\n")}\n`;
}
