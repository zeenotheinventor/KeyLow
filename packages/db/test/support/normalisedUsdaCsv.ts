import { formatCsv } from "../../scripts/cofid/csv";
import { NORMALISED_COLUMNS } from "../../scripts/usda/normalise";

export type NormalisedUsdaCells = Readonly<Record<(typeof NORMALISED_COLUMNS)[number], string>>;

/** A small, hand written row in the shape `normalise` writes, with a short micros object so a test stays readable. */
export const rawThigh: NormalisedUsdaCells = {
  fdc_id: "172385",
  name: "Chicken, thigh, raw, meat and skin",
  sr_description: "Chicken, broilers or fryers, thigh, meat and skin, raw",
  food_group: "Poultry Products",
  basis: "per_100g",
  kcal: "221",
  protein_g: "16.52",
  fat_g: "16.61",
  sat_fat_g: "4.524",
  carbs_g: "0.25",
  sugars_g: "0",
  fibre_g: "0",
  salt_g: "0.2025",
  micros: '{"usda_1087":7,"usda_1089":0.68}',
  quality: '{"fibre_method":"aoac","carbs_convention":"eu"}',
  portion_label: "1 thigh",
  portion_amount: "1",
  portion_grams: "193",
  portion_modifier: "thigh with skin",
};

export const roastedThigh: NormalisedUsdaCells = {
  ...rawThigh,
  fdc_id: "173625",
  name: "Chicken, thigh, roasted, meat and skin",
  sr_description: "Chicken, broilers or fryers, thigh, meat and skin, cooked, roasted",
  kcal: "232",
  protein_g: "23.26",
  fat_g: "14.71",
  sat_fat_g: "4.111",
  carbs_g: "0",
  salt_g: "0.255",
  micros: '{"usda_1087":9}',
  portion_grams: "137",
};

/** The text `normalise` would write for these rows. */
export const normalisedCsvOf = (...rows: readonly NormalisedUsdaCells[]): string =>
  formatCsv([
    [...NORMALISED_COLUMNS],
    ...rows.map((row) => NORMALISED_COLUMNS.map((column) => row[column])),
  ]);
