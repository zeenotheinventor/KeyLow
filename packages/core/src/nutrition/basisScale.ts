import type { NutrientBasis } from "../schemas/food";

/**
 * The number a food's nutrient columns are multiplied by for an amount in its own basis unit: the amount
 * over 100 for a food per 100 g or per 100 ml, and the count itself for a food per portion, whose columns
 * are the values of one portion. The one place that says so.
 */
export const scaleOfBasis = (basis: NutrientBasis, amount: number): number =>
  basis === "per_portion" ? amount : amount / 100;
