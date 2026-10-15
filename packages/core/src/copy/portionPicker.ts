import { formatGrams } from "../format/numbers";

import type { NutrientBasis } from "../schemas/food";

/** The words of the portion picker that no other screen shares, as its boards draw them. */
export const PORTION_PICKER = {
  amountLabel: "Amount",
  unitLabel: "Unit",
  addAction: "Add",
  /** The hero's caption while there is no valid amount. */
  noAmountBasis: "For this amount",
  /** What the hero's values read while there is no valid amount: an en dash. */
  noValue: "\u2013",
  /** What a screen reader hears on a macro tile while there is no valid amount. */
  noAmountTile: "no amount",
};

/** The heading of the per 100 list under the hero: "Per 100 g", or "Per 100 ml" for a drink. */
export const describePer100Heading = (basis: NutrientBasis): string =>
  basis === "per_100g" ? "Per 100 g" : "Per 100 ml";

/** The line under the hero of a food found by barcode: "Scanned 5201054013410". */
export const describeScannedCode = (code: string): string => `Scanned ${code}`;

export type AmountBasisInput =
  | { unit: "g" | "ml"; quantity: number }
  | {
      unit: "portion";
      quantity: number;
      /** The portion as the food names it, such as "1 medium". */
      portionLabel: string;
      /** The size of one portion, in grams or millilitres. */
      portionSize: { amount: number; unit: "g" | "ml" };
    };

/**
 * The hero's caption for the chosen amount: "For 150 g", "For 1 medium (100 g)" for one portion and
 * "For 2 × 1 medium (200 g)" for more. The portion's size is the whole amount, so it is the
 * portion's size times the quantity.
 */
export const describeAmountBasis = (input: AmountBasisInput): string => {
  if (input.unit !== "portion") {
    return `For ${formatGrams(input.quantity)} ${input.unit}`;
  }
  const { quantity, portionLabel, portionSize } = input;
  const total = `${formatGrams(quantity * portionSize.amount)} ${portionSize.unit}`;

  return quantity === 1
    ? `For ${portionLabel} (${total})`
    : `For ${formatGrams(quantity)} × ${portionLabel} (${total})`;
};

/** The word after the amount field's value for a count of portions: "portion" for 1, "portions" otherwise. */
export const describePortionCount = (quantity: number): string =>
  quantity === 1 ? "portion" : "portions";
