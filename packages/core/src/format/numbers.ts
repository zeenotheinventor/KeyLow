export type WeightUnit = "kg" | "lb" | "st";

const TRUE_MINUS_SIGN = "−";
const THREE_DIGITS_BEFORE_THE_END = /\B(?=(\d{3})+(?!\d))/g;

/** `Math.round(-0.4)` is -0, which would print as "-0". Adding zero turns it into +0. */
const withoutNegativeZero = (value: number): number => value + 0;

/** The thousands separator is written by hand, because Hermes and Node must agree to the character. */
const groupThousands = (digits: string): string => digits.replace(THREE_DIGITS_BEFORE_THE_END, ",");

/**
 * Calories: a whole number with a thousands separator, so `2480` reads `2,480`. Matches the design
 * system's `Format.calories` for every finite input, except that a value rounding to zero reads
 * `0` where `toLocaleString` would print `-0`.
 */
export const formatCalories = (kcal: number): string => {
  const rounded = withoutNegativeZero(Math.round(kcal));
  const unsigned = groupThousands(String(Math.abs(rounded)));
  return rounded < 0 ? `-${unsigned}` : unsigned;
};

/** Grams: one decimal only when the absolute value is under 10 (a trailing `.0` dropped), otherwise whole. */
export const formatGrams = (grams: number): string =>
  Math.abs(grams) < 10
    ? (Math.round(grams * 10) / 10).toFixed(1).replace(/\.0$/, "")
    : String(withoutNegativeZero(Math.round(grams)));

/** Weight: always one decimal, in kg, lb or st. */
export const formatWeight = (value: number, unit: WeightUnit = "kg"): string =>
  `${(Math.round(value * 10) / 10).toFixed(1)} ${unit}`;

/** A signed amount over or under a target in grams. A negative amount takes the true minus sign. */
export const formatDeltaGrams = (grams: number): string => {
  const sign = grams > 0 ? "+" : grams < 0 ? TRUE_MINUS_SIGN : "";
  return `${sign}${formatGrams(Math.abs(grams))} g`;
};

/** A share of energy as the design writes it: a whole number, a space, then the per cent sign. */
export const formatEnergyShare = (percent: number): string => `${percent} %`;
