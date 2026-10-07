import { formatAmount } from "../../lib/formatAmount";

import type { NutrientBasis } from "@keylow/core/schemas";

const BASIS_UNITS: Record<NutrientBasis, string> = {
  per_100g: "100 g",
  per_100ml: "100 ml",
};

/** The energy of a food as a row shows it, or a statement that it is not given, never zero. */
export function describeEnergy(kcal: number | null, basis: NutrientBasis): string {
  return kcal === null
    ? "Energy not given"
    : `${formatAmount(kcal)} kcal per ${BASIS_UNITS[basis]}`;
}
