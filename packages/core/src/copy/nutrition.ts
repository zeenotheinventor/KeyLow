import { spokenAmount } from "./spokenAmount";
import { formatCalories, formatEnergyShare } from "../format/numbers";

import type { NutrientBasis } from "../schemas/food";

/** A nutrient the source does not state is "not given". It is never shown as 0. */
export const NOT_GIVEN = "not given";
export const ENERGY_NOT_GIVEN = "Energy not given";

export const VALUES_PER_100_G_NOTE = "Values per 100 g unless marked";
const SERVINGS_CONFIRMED_ON_OPEN = "servings are confirmed when you open a product";

/**
 * The note above the live Open Food Facts group of a search that shows servings. A live row's serving
 * is a first guess, so the note says it is confirmed on open, and adds the per 100 g fact when some
 * rows are still drawn per 100 g.
 */
export const describeLiveGroupNote = (hasPer100Rows: boolean): string =>
  hasPer100Rows
    ? `${VALUES_PER_100_G_NOTE}, and ${SERVINGS_CONFIRMED_ON_OPEN}`
    : "Servings are confirmed when you open a product";

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
