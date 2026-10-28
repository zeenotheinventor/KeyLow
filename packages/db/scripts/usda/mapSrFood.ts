import { foodQualitySchema, resolveCarbs } from "@keylow/core";

import type { FoodQuality, NutrientBasis } from "@keylow/core";

/** The SR nutrient ids the mapping reads by name. Every other nutrient with an amount goes to micros. */
export const SR_NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  saturatedFat: 1258,
  carbs: 1005,
  sugars: 2000,
  fibre: 1079,
  sodium: 1093,
} as const;

const MAPPED_NUTRIENT_IDS: ReadonlySet<number> = new Set(Object.values(SR_NUTRIENT_IDS));

const SALT_GRAMS_PER_SODIUM_MILLIGRAM = 2.5 / 1000;

/** The food fields that are listed in `fields_missing` when null, in this order. */
const HEADLINE_FIELDS = ["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"] as const;
/** The headline fields whose absence makes a food suspect, which are the four OFF foods use. */
const SUSPECT_FIELDS: ReadonlySet<string> = new Set(["kcal", "protein_g", "fat_g", "carbs_g"]);

/** One SR Legacy food: its amounts per 100 g by nutrient id, and its SR category description. */
export type SrFood = {
  fdcId: string;
  description: string;
  foodGroup: string | null;
  nutrients: ReadonlyMap<number, number>;
};

export type UsdaFood = {
  source: "usda";
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

const roundToSixDecimals = (value: number): number => Math.round(value * 1e6) / 1e6;

function buildMicros(nutrients: ReadonlyMap<number, number>): Record<string, number> {
  const unmapped = [...nutrients].filter(([nutrientId]) => !MAPPED_NUTRIENT_IDS.has(nutrientId));
  return Object.fromEntries(
    unmapped
      .sort(([firstId], [secondId]) => firstId - secondId)
      .map(([nutrientId, amount]) => [`usda_${nutrientId}`, amount]),
  );
}

/**
 * Maps one SR Legacy food to a `foods` row, per 100 g. Carbohydrate is SR's by-difference figure less
 * fibre, through the same rule OFF's US labels use. Salt is sodium in mg times 2.5 over 1000. Missing
 * is null, never 0. The Ki-Lo name comes from the curated list, not from SR's description.
 */
export function mapSrFood(food: SrFood, name: string): UsdaFood {
  const amount = (nutrientId: number): number | null => food.nutrients.get(nutrientId) ?? null;
  const fibre = amount(SR_NUTRIENT_IDS.fibre);
  const sodium = amount(SR_NUTRIENT_IDS.sodium);
  const { carbs, convention } = resolveCarbs({
    carbs: amount(SR_NUTRIENT_IDS.carbs),
    fibre,
    usLabelled: true,
  });

  const fields = {
    kcal: amount(SR_NUTRIENT_IDS.kcal),
    protein_g: amount(SR_NUTRIENT_IDS.protein),
    fat_g: amount(SR_NUTRIENT_IDS.fat),
    carbs_g: carbs,
    fibre_g: fibre,
  };
  const fieldsMissing = HEADLINE_FIELDS.filter((field) => fields[field] === null);

  return {
    source: "usda",
    source_ref: food.fdcId,
    owner_id: null,
    name,
    brand: null,
    barcode: null,
    basis: "per_100g",
    density_g_per_ml: null,
    ...fields,
    sat_fat_g: amount(SR_NUTRIENT_IDS.saturatedFat),
    sugars_g: amount(SR_NUTRIENT_IDS.sugars),
    salt_g: sodium === null ? null : roundToSixDecimals(sodium * SALT_GRAMS_PER_SODIUM_MILLIGRAM),
    micros: buildMicros(food.nutrients),
    quality: foodQualitySchema.parse({
      ...(fieldsMissing.some((field) => SUSPECT_FIELDS.has(field)) ? { suspect: true } : {}),
      ...(fieldsMissing.length > 0 ? { fields_missing: fieldsMissing } : {}),
      ...(fibre === null ? {} : { fibre_method: "aoac" }),
      ...(convention === undefined ? {} : { carbs_convention: convention }),
    }),
    food_group: food.foodGroup,
    fetched_at: null,
  };
}
