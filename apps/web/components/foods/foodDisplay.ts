import type { FoodSource, NutrientBasis } from "@keylow/core/schemas";

export const SOURCE_LABELS: Record<FoodSource, string> = {
  user: "Own food",
  cofid: "CoFID",
  off: "Open Food Facts",
};

export const BASIS_LABELS: Record<NutrientBasis, string> = {
  per_100g: "Per 100 g",
  per_100ml: "Per 100 ml",
};

export const basisUnit = (basis: NutrientBasis) => (basis === "per_100g" ? "g" : "ml");

/** A nutrient amount to one decimal place, without a trailing `.0`. */
export const formatAmount = (amount: number) => String(Math.round(amount * 10) / 10);

/** The energy of a food on its own basis, or a plain statement that it is not given. */
export function describeEnergy({ kcal, basis }: { kcal: number | null; basis: NutrientBasis }) {
  return kcal === null
    ? "Energy not given"
    : `${formatAmount(kcal)} kcal per 100 ${basisUnit(basis)}`;
}

export function describeRateLimit(retryAfterSeconds: number | undefined) {
  return retryAfterSeconds === undefined
    ? "Open Food Facts is busy at the moment. Try again in a little while."
    : `Open Food Facts is busy at the moment. Try again in ${String(retryAfterSeconds)} seconds.`;
}
