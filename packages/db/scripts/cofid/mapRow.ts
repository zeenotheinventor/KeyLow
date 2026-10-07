import { foodQualitySchema } from "@keylow/core";

import { columnName, FACTORS_SHEET_SLUG, IDENTITY_COLUMNS } from "./columns";
import { parseCell, UnrecognisedCellError } from "./parseCell";

import type { FoodQuality, NutrientBasis } from "@keylow/core";

/** The normalised CSV columns the mapping reads by name. Every other nutrient column goes to micros. */
export const COFID_COLUMNS = {
  kcal: columnName("proximates", "Energy (kcal) (kcal)"),
  protein: columnName("proximates", "Protein (g)"),
  fat: columnName("proximates", "Fat (g)"),
  carbs: columnName("proximates", "Carbohydrate (g)"),
  sugars: columnName("proximates", "Total sugars (g)"),
  saturatedFat: columnName("proximates", "Satd FA /100g fd (g)"),
  fibreEnglyst: columnName("proximates", "NSP (g)"),
  fibreAoac: columnName("proximates", "AOAC fibre (g)"),
  sodium: columnName("inorganics", "Sodium (mg)"),
} as const;

const CONSUMED_COLUMNS: ReadonlySet<string> = new Set(Object.values(COFID_COLUMNS));
const IDENTITY_COLUMN_NAMES: ReadonlySet<string> = new Set(IDENTITY_COLUMNS);

// The 1.1 notes sheet says alcoholic beverages are given per 100 ml, and the alcoholic beverage food
// groups are the ones whose code starts with Q (beer, cider, wine, fortified wine, vermouth, liqueurs, spirits).
const ALCOHOLIC_BEVERAGE_GROUP_PREFIX = "Q";

const SALT_GRAMS_PER_SODIUM_MILLIGRAM = 2.5 / 1000;

/** The food fields that are always listed in `fields_missing` when null, in this order. */
const HEADLINE_FIELDS = ["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"] as const;
/** The headline fields whose absence makes a food suspect, which are the four OFF foods use. */
const SUSPECT_FIELDS: ReadonlySet<string> = new Set(["kcal", "protein_g", "fat_g", "carbs_g"]);
/** The order of `trace_fields`: the food's own fields first, then the micros in column order. */
const FIELD_ORDER = [
  "kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "sat_fat_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
] as const;

type FoodField = (typeof FIELD_ORDER)[number];
type CsvRow = Readonly<Record<string, string>>;
type Amount = { value: number | null; isTrace: boolean };

export type CofidFood = {
  source: "cofid";
  source_ref: string;
  owner_id: null;
  name: string;
  brand: null;
  barcode: null;
  basis: NutrientBasis;
  density_g_per_ml: null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  sat_fat_g: number | null;
  carbs_g: number | null;
  sugars_g: number | null;
  fibre_g: number | null;
  salt_g: number | null;
  micros: Record<string, number>;
  quality: FoodQuality;
  food_group: string | null;
  fetched_at: null;
};

export type MappedCofidFood = {
  sourceRef: string;
  food: CofidFood;
  /** The whole source row as the CSV holds it, with blank cells as null. */
  raw: Record<string, string | null>;
};

/** Fails with one message naming every column the mapping needs that the header lacks. */
export function requireCofidColumns(header: readonly string[]): void {
  const required = ["food_code", "food_name", "food_group", ...Object.values(COFID_COLUMNS)];
  const missing = required.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new Error(`The CSV has no column ${missing.join(", ")}`);
  }
}

function cellText(row: CsvRow, column: string): string {
  const text = row[column];
  if (text === undefined) {
    throw new Error(`The row has no column ${column}`);
  }
  return text;
}

/** Reads one cell, so that an unreadable one is reported with its food and column. */
function readCell(row: CsvRow, column: string): ReturnType<typeof parseCell> {
  try {
    return parseCell(cellText(row, column));
  } catch (error) {
    if (error instanceof UnrecognisedCellError) {
      throw new Error(`Food ${row["food_code"]}, column ${column}: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
}

/** A number, a trace (0, flagged) or no value. N, blank and a negative amount all mean no value. */
function readAmount(row: CsvRow, column: string): Amount {
  const cell = readCell(row, column);
  if (cell.kind === "number") {
    return { value: cell.value, isTrace: false };
  }
  return { value: cell.kind === "trace" ? 0 : null, isTrace: cell.kind === "trace" };
}

const roundToSixDecimals = (value: number): number => Math.round(value * 1e6) / 1e6;

/** Fibre by AOAC where it has a value, otherwise by Englyst (the NSP column). */
function readFibre(row: CsvRow): { amount: Amount; method: "aoac" | "englyst" | undefined } {
  const aoac = readAmount(row, COFID_COLUMNS.fibreAoac);
  if (aoac.value !== null) {
    return { amount: aoac, method: "aoac" };
  }
  const englyst = readAmount(row, COFID_COLUMNS.fibreEnglyst);
  return { amount: englyst, method: englyst.value === null ? undefined : "englyst" };
}

function readMicros(row: CsvRow): { micros: Record<string, number>; traceNames: string[] } {
  const micros: Record<string, number> = {};
  const traceNames: string[] = [];

  for (const column of Object.keys(row)) {
    if (IDENTITY_COLUMN_NAMES.has(column) || CONSUMED_COLUMNS.has(column)) {
      continue;
    }
    // Factors are read so an unreadable cell is still caught, but they are not nutrient amounts.
    const { value, isTrace } = readAmount(row, column);
    if (value !== null && !column.startsWith(`${FACTORS_SHEET_SLUG}_`)) {
      micros[column] = value;
      if (isTrace) {
        traceNames.push(column);
      }
    }
  }
  return { micros, traceNames };
}

function buildQuality(input: {
  fields: Readonly<Record<FoodField, Amount>>;
  fibreMethod: "aoac" | "englyst" | undefined;
  microTraceNames: readonly string[];
}): FoodQuality {
  const { fields, fibreMethod, microTraceNames } = input;
  const fieldsMissing = HEADLINE_FIELDS.filter((field) => fields[field].value === null);
  const traceFields = [...FIELD_ORDER.filter((field) => fields[field].isTrace), ...microTraceNames];

  return foodQualitySchema.parse({
    ...(fieldsMissing.some((field) => SUSPECT_FIELDS.has(field)) ? { suspect: true } : {}),
    ...(fieldsMissing.length > 0 ? { fields_missing: fieldsMissing } : {}),
    ...(fibreMethod === undefined ? {} : { fibre_method: fibreMethod }),
    ...(traceFields.length > 0 ? { trace_fields: traceFields } : {}),
  });
}

/**
 * Maps one row of the normalised CSV to a `foods` row. CoFID values are per 100 g edible portion (per
 * 100 ml for alcoholic beverages). Energy is the kcal column. Salt is sodium in mg times 2.5 over 1000.
 * A trace becomes 0 and is listed in `quality.trace_fields`, N and blank become null, and every other
 * nutrient goes into micros. The source row is kept whole in `raw`.
 */
export function mapRow(row: CsvRow): MappedCofidFood {
  const sourceRef = cellText(row, "food_code");
  if (sourceRef === "") {
    throw new Error("A row has no food code");
  }
  const name = cellText(row, "food_name");
  if (name === "") {
    throw new Error(`Food ${sourceRef} has no name`);
  }
  const group = cellText(row, "food_group");

  const sodium = readAmount(row, COFID_COLUMNS.sodium);
  const { amount: fibre, method: fibreMethod } = readFibre(row);
  const fields: Record<FoodField, Amount> = {
    kcal: readAmount(row, COFID_COLUMNS.kcal),
    protein_g: readAmount(row, COFID_COLUMNS.protein),
    fat_g: readAmount(row, COFID_COLUMNS.fat),
    carbs_g: readAmount(row, COFID_COLUMNS.carbs),
    sat_fat_g: readAmount(row, COFID_COLUMNS.saturatedFat),
    sugars_g: readAmount(row, COFID_COLUMNS.sugars),
    fibre_g: fibre,
    salt_g: {
      value:
        sodium.value === null
          ? null
          : roundToSixDecimals(sodium.value * SALT_GRAMS_PER_SODIUM_MILLIGRAM),
      isTrace: sodium.isTrace,
    },
  };
  const { micros, traceNames } = readMicros(row);

  return {
    sourceRef,
    food: {
      source: "cofid",
      source_ref: sourceRef,
      owner_id: null,
      name,
      brand: null,
      barcode: null,
      basis: group.startsWith(ALCOHOLIC_BEVERAGE_GROUP_PREFIX) ? "per_100ml" : "per_100g",
      density_g_per_ml: null,
      kcal: fields.kcal.value,
      protein_g: fields.protein_g.value,
      fat_g: fields.fat_g.value,
      sat_fat_g: fields.sat_fat_g.value,
      carbs_g: fields.carbs_g.value,
      sugars_g: fields.sugars_g.value,
      fibre_g: fields.fibre_g.value,
      salt_g: fields.salt_g.value,
      micros,
      quality: buildQuality({ fields, fibreMethod, microTraceNames: traceNames }),
      food_group: group === "" ? null : group,
      fetched_at: null,
    },
    raw: Object.fromEntries(
      Object.entries(row).map(([column, text]) => [column, text === "" ? null : text]),
    ),
  };
}
