import { parseCsv } from "../cofid/csv";

/** The columns of restaurant-foods.csv, in order. The nutrient columns are per portion, as the chain publishes them. */
export const RESTAURANT_COLUMNS = [
  "ref",
  "wave",
  "chain",
  "name",
  "portion_label",
  "portion_grams",
  "weight_basis",
  "kcal",
  "protein_g",
  "fat_g",
  "sat_fat_g",
  "carbs_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
  "published_kcal_per_100g",
  "source_url",
  "retrieved_on",
] as const;

export type WeightBasis = "published" | "derived" | "none";

/** One row of the CSV. A figure the chain does not publish is null. The keys are the CSV columns, so the row is stored as it is read. */
export type RestaurantFoodRow = {
  ref: string;
  wave: number;
  chain: string;
  name: string;
  portion_label: string;
  portion_grams: number | null;
  weight_basis: WeightBasis;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  sat_fat_g: number | null;
  carbs_g: number | null;
  sugars_g: number | null;
  fibre_g: number | null;
  salt_g: number | null;
  published_kcal_per_100g: number | null;
  source_url: string;
  retrieved_on: string;
};

type Column = (typeof RESTAURANT_COLUMNS)[number];

function parseNumber(ref: string, column: Column, text: string): number | null {
  if (text === "") {
    return null;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error(`${ref}: ${column} ${JSON.stringify(text)} is not a number`);
  }
  return value;
}

const isWeightBasis = (text: string): text is WeightBasis =>
  text === "published" || text === "derived" || text === "none";

function parseRow(fields: readonly string[], rowNumber: number): RestaurantFoodRow {
  if (fields.length !== RESTAURANT_COLUMNS.length) {
    throw new Error(
      `CSV row ${rowNumber} has ${fields.length} fields for ${RESTAURANT_COLUMNS.length} columns`,
    );
  }
  const cells = new Map(RESTAURANT_COLUMNS.map((column, index) => [column, fields[index] ?? ""]));
  const textOf = (column: Column): string => cells.get(column) ?? "";
  const numberOf = (column: Column): number | null =>
    parseNumber(textOf("ref"), column, textOf(column));
  const weightBasis = textOf("weight_basis");
  if (!isWeightBasis(weightBasis)) {
    throw new Error(
      `${textOf("ref")}: weight_basis ${JSON.stringify(weightBasis)} is not published, derived or none`,
    );
  }
  const wave = numberOf("wave");
  if (wave === null) {
    throw new Error(`${textOf("ref")}: wave is blank`);
  }
  return {
    ref: textOf("ref"),
    wave,
    chain: textOf("chain"),
    name: textOf("name"),
    portion_label: textOf("portion_label"),
    portion_grams: numberOf("portion_grams"),
    weight_basis: weightBasis,
    kcal: numberOf("kcal"),
    protein_g: numberOf("protein_g"),
    fat_g: numberOf("fat_g"),
    sat_fat_g: numberOf("sat_fat_g"),
    carbs_g: numberOf("carbs_g"),
    sugars_g: numberOf("sugars_g"),
    fibre_g: numberOf("fibre_g"),
    salt_g: numberOf("salt_g"),
    published_kcal_per_100g: numberOf("published_kcal_per_100g"),
    source_url: textOf("source_url"),
    retrieved_on: textOf("retrieved_on"),
  };
}

export function parseRestaurantCsv(csv: string): RestaurantFoodRow[] {
  const [header, ...records] = parseCsv(csv);
  if (header?.join(",") !== RESTAURANT_COLUMNS.join(",")) {
    throw new Error(
      `The restaurant CSV needs these columns, in this order: ${RESTAURANT_COLUMNS.join(", ")}`,
    );
  }
  // Row 1 is the header.
  return records.map((fields, index) => parseRow(fields, index + 2));
}
