import { RESTAURANT_COLUMNS, type RestaurantFoodRow } from "./restaurantFoodsCsv";
import { formatCsv, parseCsv } from "../cofid/csv";
import { mapRow } from "../cofid/mapRow";

/** The first wave that holds Nando's, whose energy is published and whose macros are estimated (ADR 0003, Amendment 20). */
export const NANDOS_WAVE = 4;

/** What a reference food holds per 100 g. A nutrient the source does not record counts as 0 in a sum. */
export type ReferenceNutrients = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  sat_fat_g: number;
  carbs_g: number;
  sugars_g: number;
  fibre_g: number;
  salt_g: number;
};

type NutrientKey = keyof ReferenceNutrients;
const NUTRIENT_KEYS: readonly NutrientKey[] = [
  "kcal",
  "protein_g",
  "fat_g",
  "sat_fat_g",
  "carbs_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
];

/** One part of a dish: a CoFID food and the weight of it assumed to be in one portion, before scaling. */
export type EstimateComponent = {
  name: string;
  cofid_code: string;
  grams: number;
};

export type EstimateItem = {
  ref: string;
  name: string;
  portion_label: string;
  /** The energy Nando's publishes for one portion. */
  published_kcal: number;
  /** The Nando's UK allergen and ingredient page the components were read from. */
  ingredients_url: string;
  /** The factor the components were scaled by when the file was written. A test recomputes it. */
  scale_factor: number;
  components: EstimateComponent[];
};

export type NandosEstimates = {
  retrieved_on: string;
  /** The Nando's UK menu page that prints the energy of every item. */
  kcal_source_url: string;
  items: EstimateItem[];
};

export type ItemEstimate = {
  scale_factor: number;
  nutrients: ReferenceNutrients;
};

export function parseNandosEstimates(json: string): NandosEstimates {
  const parsed: unknown = JSON.parse(json);
  // The cast is safe because the file is committed data in this shape, and the tests that read it check every field they use.
  return parsed as NandosEstimates;
}

/** Reads CoFID foods per 100 g edible portion, through the same mapping the CoFID import uses. */
export function readCofidReferences(
  cofidCsv: string,
  codes: Iterable<string>,
): Map<string, ReferenceNutrients> {
  const [header = [], ...records] = parseCsv(cofidCsv);
  const wanted = new Set(codes);
  const references = new Map<string, ReferenceNutrients>();
  for (const fields of records) {
    const code = fields[header.indexOf("food_code")];
    if (code === undefined || !wanted.has(code)) {
      continue;
    }
    const { food } = mapRow(
      Object.fromEntries(header.map((name, index) => [name, fields[index] ?? ""])),
    );
    references.set(code, {
      kcal: food.kcal ?? 0,
      protein_g: food.protein_g ?? 0,
      fat_g: food.fat_g ?? 0,
      sat_fat_g: food.sat_fat_g ?? 0,
      carbs_g: food.carbs_g ?? 0,
      sugars_g: food.sugars_g ?? 0,
      fibre_g: food.fibre_g ?? 0,
      salt_g: food.salt_g ?? 0,
    });
  }
  const missing = [...wanted].filter((code) => !references.has(code));
  if (missing.length > 0) {
    throw new Error(`CoFID has no food ${missing.join(", ")}`);
  }
  return references;
}

/**
 * Adds up the components at their assumed weights, then scales every one of them by a single factor so the
 * energy equals the published kcal exactly. The scaled protein, fat, saturates, carbohydrate, sugars, fibre
 * and salt are the estimate.
 */
export function estimateItem(
  item: EstimateItem,
  references: ReadonlyMap<string, ReferenceNutrients>,
): ItemEstimate {
  const unscaled = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]));
  for (const component of item.components) {
    const reference = references.get(component.cofid_code);
    if (reference === undefined) {
      throw new Error(`${item.ref}: no reference food ${component.cofid_code}`);
    }
    for (const key of NUTRIENT_KEYS) {
      unscaled[key] = (unscaled[key] ?? 0) + (reference[key] * component.grams) / 100;
    }
  }
  const unscaledKcal = unscaled["kcal"] ?? 0;
  if (unscaledKcal <= 0) {
    throw new Error(`${item.ref}: the components hold no energy`);
  }
  const scaleFactor = item.published_kcal / unscaledKcal;
  const scaled = (key: NutrientKey): number => (unscaled[key] ?? 0) * scaleFactor;
  return {
    scale_factor: scaleFactor,
    nutrients: {
      kcal: item.published_kcal,
      protein_g: scaled("protein_g"),
      fat_g: scaled("fat_g"),
      sat_fat_g: scaled("sat_fat_g"),
      carbs_g: scaled("carbs_g"),
      sugars_g: scaled("sugars_g"),
      fibre_g: scaled("fibre_g"),
      salt_g: scaled("salt_g"),
    },
  };
}

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** The CSV row of a food: per portion, with no weight, the published energy and the estimated rest. */
export function nandosCsvRow(
  item: EstimateItem,
  estimates: NandosEstimates,
  references: ReadonlyMap<string, ReferenceNutrients>,
): RestaurantFoodRow {
  const { nutrients } = estimateItem(item, references);
  return {
    ref: item.ref,
    wave: NANDOS_WAVE,
    chain: "Nando's",
    name: item.name,
    portion_label: item.portion_label,
    portion_grams: null,
    weight_basis: "none",
    kcal: item.published_kcal,
    protein_g: roundTo(nutrients.protein_g, 1),
    fat_g: roundTo(nutrients.fat_g, 1),
    sat_fat_g: roundTo(nutrients.sat_fat_g, 1),
    carbs_g: roundTo(nutrients.carbs_g, 1),
    sugars_g: roundTo(nutrients.sugars_g, 1),
    fibre_g: roundTo(nutrients.fibre_g, 1),
    salt_g: roundTo(nutrients.salt_g, 2),
    published_kcal_per_100g: null,
    source_url: estimates.kcal_source_url,
    retrieved_on: estimates.retrieved_on,
  };
}

const cellOf = (value: string | number | null): string => (value === null ? "" : String(value));

/** The Nando's lines of restaurant-foods.csv, derived from the estimates. This is how the rows are written. */
export function renderNandosCsvRows(
  estimates: NandosEstimates,
  references: ReadonlyMap<string, ReferenceNutrients>,
): string {
  return formatCsv(
    estimates.items.map((item) => {
      const row = nandosCsvRow(item, estimates, references);
      return RESTAURANT_COLUMNS.map((column) => cellOf(row[column]));
    }),
  );
}
