import { describePortionNoun } from "./portionPicker";
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
  per_portion: "per portion",
};

const SPOKEN_BASIS_LABELS: Readonly<Record<NutrientBasis, string>> = {
  per_100g: "per 100 grams",
  per_100ml: "per 100 millilitres",
  per_portion: "per portion",
};

// "per bucket" for the portion "1 bucket", "per 6 nuggets" for "6 nuggets": the noun when the label has one,
// else the label as it is.
const perPortionOf = (portionLabel: string): string =>
  `per ${describePortionNoun(portionLabel) ?? portionLabel.trim().toLowerCase()}`;

/**
 * What a food's values are per: "per 100 g", "per 100 ml", and for a food per portion the name of its one
 * portion, "per bucket". `portionLabel` is that portion's label and is read only for a food per portion, so a
 * screen that has it can always pass it. Without it, a food per portion is "per portion".
 */
export const describeBasis = (basis: NutrientBasis, portionLabel?: string): string =>
  basis === "per_portion" && portionLabel !== undefined
    ? perPortionOf(portionLabel)
    : BASIS_LABELS[basis];

/** The basis spelled out for a screen reader. */
export const describeSpokenBasis = (basis: NutrientBasis, portionLabel?: string): string =>
  basis === "per_portion" && portionLabel !== undefined
    ? perPortionOf(portionLabel)
    : SPOKEN_BASIS_LABELS[basis];

/** The energy spelled out for a screen reader: "energy 148 kilocalories", or "energy not given". */
export const describeEnergy = (kcal: number | null): string =>
  kcal === null
    ? `energy ${NOT_GIVEN}`
    : `energy ${spokenAmount(formatCalories(kcal), "kilocalorie", "kilocalories")}`;

/** A macro's share of the food's energy, as the detail tiles write it: "32 % of energy". */
export const describeShareOfEnergy = (percent: number): string =>
  `${formatEnergyShare(percent)} of energy`;
