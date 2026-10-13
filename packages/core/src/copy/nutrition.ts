import { spokenAmount } from "./spokenAmount";
import { formatCalories, formatEnergyShare } from "../format/numbers";

import type { NutrientBasis } from "../schemas/food";

/** A nutrient the source does not state is "not given". It is never shown as 0. */
export const NOT_GIVEN = "not given";
export const ENERGY_NOT_GIVEN = "Energy not given";

export const VALUES_PER_100_G_NOTE = "Values per 100 g unless marked";
export const SHARES_OF_ENERGY_ARE_ESTIMATES = "Shares of energy are estimates";

const BASIS_LABELS: Readonly<Record<NutrientBasis, string>> = {
  per_100g: "per 100 g",
  per_100ml: "per 100 ml",
};

const SPOKEN_BASIS_LABELS: Readonly<Record<NutrientBasis, string>> = {
  per_100g: "per 100 grams",
  per_100ml: "per 100 millilitres",
};

export const describeBasis = (basis: NutrientBasis): string => BASIS_LABELS[basis];

/** The basis spelled out for a screen reader. */
export const describeSpokenBasis = (basis: NutrientBasis): string => SPOKEN_BASIS_LABELS[basis];

/** The energy spelled out for a screen reader: "energy 148 kilocalories", or "energy not given". */
export const describeEnergy = (kcal: number | null): string =>
  kcal === null
    ? `energy ${NOT_GIVEN}`
    : `energy ${spokenAmount(formatCalories(kcal), "kilocalorie", "kilocalories")}`;

/** A macro's share of the food's energy, as the detail tiles write it: "32 % of energy". */
export const describeShareOfEnergy = (percent: number): string =>
  `${formatEnergyShare(percent)} of energy`;
