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

/** The words of the food search sheet while food is being logged to a day. */
export const LOG_SEARCH = {
  title: "Log food",
  /** The toast's action after a plus: it removes the entry that plus logged. */
  undo: "Undo",
  /** The toast when Undo could not remove the entry. */
  undoFailed: "Couldn't undo. Try again.",
  /** What Recent says when it could not be loaded, in place of its rows. */
  recentFailed: {
    title: "Couldn't load recent foods",
    body: "Check your connection and try again.",
  },
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

const squash = (text: string): string => text.replace(/\s+/g, "").toLowerCase();
const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The size is already said when the label holds it as a whole number: "30 g" says 30 g and "130 g" does not.
const labelSays = (label: string, written: string): boolean =>
  new RegExp(`(?:^|[^0-9.])${escapeForPattern(squash(written))}`).test(squash(label));

/**
 * A portion with its size, such as "1 medium (100 g)" for the portion "1 medium". A label that already
 * says its size, such as the "30 g" Open Food Facts gives a serving, is left as it is.
 */
export const describePortionWithSize = (
  label: string,
  size: { amount: number; unit: "g" | "ml" },
): string => {
  const written = `${formatGrams(size.amount)} ${size.unit}`;

  return labelSays(label, written) ? label : `${label} (${written})`;
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
  if (quantity === 1) {
    return `For ${describePortionWithSize(portionLabel, portionSize)}`;
  }
  const total = `${formatGrams(quantity * portionSize.amount)} ${portionSize.unit}`;

  return `For ${formatGrams(quantity)} × ${portionLabel} (${total})`;
};

export type VolumeBasisInput = { quantity: number; weightInGrams: number | null } & (
  | { unit: "ml" }
  | {
      unit: "spoon";
      /** The spoon as the picker names it, such as "1 tbsp". */
      spoonLabel: string;
      /** The volume of the whole amount, in millilitres: the count times the spoon's size. */
      volumeMl: number;
    }
);

/**
 * The hero's caption for an amount measured by volume: "For 250 ml (258 g)", and for a spoon its
 * millilitres first, "For 2 tbsp (30 ml, 28 g)". The weight is left out when the food has no density to
 * work it out with, as for a drink measured per 100 ml: "For 250 ml", "For 2 tbsp (30 ml)". It is the
 * weight itself and never "about" it, because a logged entry freezes the same figure.
 */
export const describeVolumeBasis = (input: VolumeBasisInput): string => {
  const weight = input.weightInGrams === null ? [] : [`${formatGrams(input.weightInGrams)} g`];
  const quantity = formatGrams(input.quantity);
  if (input.unit === "ml") {
    return `For ${quantity} ml${weight.length === 0 ? "" : ` (${weight.join(", ")})`}`;
  }
  const noun = describePortionUnit(input.spoonLabel, input.quantity);

  return `For ${quantity} ${noun} (${[`${formatGrams(input.volumeMl)} ml`, ...weight].join(", ")})`;
};

/** The word after the amount field's value for a count of portions: "portion" for 1, "portions" otherwise. */
export const describePortionCount = (quantity: number): string =>
  quantity === 1 ? "portion" : "portions";

const MEASURE = "(?:kg|mg|g|ml|cl|dl|l|fl\\.?\\s?oz|oz)";
const MEASURE_PREFIX = new RegExp(`^${MEASURE}\\b\\s*`, "i");
// "1 x 400 g tin": the multiplier and the size of each come between the count and the noun.
const SIZE_EACH = new RegExp(`^[x\u00d7]\\s*\\d+(?:[.,]\\d+)?\\s*${MEASURE}\\b\\s*`, "i");
const STARTS_WITH_COUNT = /^[\d\u00bc-\u00be]/;
const EXACTLY_ONE = /^1(?![\d.,/])\s*/;
const TRAILING_SIZE = /\s*\([^)]*\)\s*$/;
const LONGEST_NOUN = 20;

/**
 * The noun a portion's name gives the amount field, as the portion boards draw it ("medium", "bar", "pot"):
 * the label without its count, any measure that follows it and any size in brackets, so "1 medium (100 g)"
 * gives "medium". One portion is the whole label, so the noun is only taken when the label counts exactly
 * one ("1 pot", "1 x 400 g tin") or counts nothing ("Serving", "Box of 6"). "2 biscuits", "6 nuggets",
 * "1/2 pizza" and "0.5 cup" give nothing, because "1 biscuits" would be wrong. Nor does a label that has no
 * noun, such as "30 g", or one too long to sit beside a field.
 */
export const describePortionNoun = (label: string): string | undefined => {
  const withoutSize = label.trim().replace(TRAILING_SIZE, "");
  let rest = withoutSize;
  if (STARTS_WITH_COUNT.test(withoutSize)) {
    if (!EXACTLY_ONE.test(withoutSize)) {
      return undefined;
    }
    rest = withoutSize.replace(EXACTLY_ONE, "").replace(SIZE_EACH, "").replace(MEASURE_PREFIX, "");
  }
  const noun = rest.trim().toLowerCase();

  return noun === "" || noun.length > LONGEST_NOUN ? undefined : noun;
};

/**
 * What follows the amount field's value for a count of one portion: its noun when its name gives one,
 * else "portion" or "portions" for the count. The noun "cup" is the one that takes a plural, "cups" for any
 * count but exactly 1; "tsp" and "tbsp" never change, and no other noun does.
 */
export const describePortionUnit = (label: string, quantity: number): string => {
  const noun = describePortionNoun(label);

  return noun === "cup" && quantity !== 1 ? "cups" : (noun ?? describePortionCount(quantity));
};

/**
 * The line on the portion picker of a food opened from Recent: "Last logged 50 g, yesterday". `daysAgo` is
 * 0 for today and 1 for yesterday, and any other day is written by the caller as `dateLabel`, such as "Mon 12 Oct".
 */
export const describeLastLogged = (
  amountText: string,
  daysAgo: number,
  dateLabel: string,
): string => {
  const when = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : dateLabel;

  return `Last logged ${amountText}, ${when}`;
};
