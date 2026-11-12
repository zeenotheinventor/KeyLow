import type { RestaurantFoodRow } from "./restaurantFoodsCsv";
import type { FoodQuality } from "@keylow/core";

/**
 * The chains that publish energy and no macros, so every figure but the energy of their rows is estimated
 * from the dish's ingredients (ADR 0003, Amendment 20, and data/restaurants/nandos-estimates.json).
 */
const CHAINS_WITH_ESTIMATED_MACROS: ReadonlySet<string> = new Set(["Nando's"]);

export type DerivedFood = {
  basis: "per_100g" | "per_portion";
  nutrients: {
    kcal: number | null;
    protein_g: number | null;
    fat_g: number | null;
    sat_fat_g: number | null;
    carbs_g: number | null;
    sugars_g: number | null;
    fibre_g: number | null;
    salt_g: number | null;
  };
  quality: FoodQuality;
  /** The one default portion. A count portion has no grams. */
  portion: { label: string; grams: number | null };
};

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

/**
 * The shape a restaurant food is stored in (ADR 0003 Amendment 18). Where the chain publishes the weight
 * of the portion, the food is per 100 g: each per portion figure times 100 over the grams, to two decimals.
 * Where it does not, the food is per portion and keeps the figures as published, with a count portion.
 */
export function deriveFood(row: RestaurantFoodRow): DerivedFood {
  const { portion_grams: grams } = row;
  if ((row.weight_basis === "none") !== (grams === null)) {
    throw new Error(
      `${row.ref}: the weight basis ${row.weight_basis} does not match the grams ${grams ?? "none"}`,
    );
  }
  const stored = (value: number | null): number | null =>
    value === null || grams === null ? value : roundToTwoDecimals((value * 100) / grams);
  return {
    basis: grams === null ? "per_portion" : "per_100g",
    nutrients: {
      kcal: stored(row.kcal),
      protein_g: stored(row.protein_g),
      fat_g: stored(row.fat_g),
      sat_fat_g: stored(row.sat_fat_g),
      carbs_g: stored(row.carbs_g),
      sugars_g: stored(row.sugars_g),
      fibre_g: stored(row.fibre_g),
      salt_g: stored(row.salt_g),
    },
    quality: CHAINS_WITH_ESTIMATED_MACROS.has(row.chain) ? { macros_estimated: true } : {},
    portion: { label: row.portion_label, grams },
  };
}
