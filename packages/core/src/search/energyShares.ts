import type { Food } from "../schemas/food";

export type EnergyShares = {
  /** A whole per cent, or null when the macro or the energy is missing. */
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const KILOCALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const shareOfEnergy = (
  grams: number | null,
  kilocaloriesPerGram: number,
  kcal: number | null,
): number | null => {
  if (grams === null || kcal === null || kcal <= 0) {
    return null;
  }
  const share = Math.round((grams * kilocaloriesPerGram * 100) / kcal);
  // A vanishingly small energy overflows the division. That is not a share worth showing.
  return Number.isFinite(share) ? share : null;
};

/**
 * The share of a food's stated energy that comes from protein, carbohydrate and fat, in whole per
 * cent, for the "% of energy" tiles on the food detail. It is Atwater 4/4/9 over the stated kcal:
 * protein times 4, carbohydrate times 4 and fat times 9, each divided by the kcal.
 *
 * A share is null when its macro or the energy is missing, the energy is 0 or the division overflows, never 0. The shares
 * need not sum to 100, because fibre and alcohol are not counted. That is why the detail screens
 * caption them as estimates.
 */
export const energyShares = (
  food: Pick<Food, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
): EnergyShares => ({
  protein: shareOfEnergy(food.protein_g, KILOCALORIES_PER_GRAM.protein, food.kcal),
  carbs: shareOfEnergy(food.carbs_g, KILOCALORIES_PER_GRAM.carbs, food.kcal),
  fat: shareOfEnergy(food.fat_g, KILOCALORIES_PER_GRAM.fat, food.kcal),
});
