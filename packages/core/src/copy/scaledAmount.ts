import { describePortionUnit, describePortionWithSize } from "./portionPicker";
import { formatGroupedGrams } from "../format/groupedGrams";
import { formatScaledCount } from "../format/scaledCount";
import { spoonPortionOf } from "../nutrition/volume";

import type { LoggedAmount } from "./diary";
import type { QuantityUnit } from "../nutrition/units";

const MEASURED_UNIT_NAMES: Record<Exclude<QuantityUnit, "portion">, string> = {
  g: "g",
  ml: "ml",
  oz: "oz",
  fl_oz: "fl oz",
};

/**
 * Scaling multiplies by a factor that is rarely exact (13 over 3), so an amount that is exactly a half in
 * the pair form can land a hair under it (13.5 g × 13 ÷ 3 is 58.4999...) and round down. A relative
 * tolerance of one part in a billion is far above that float error (about 1e-16) and far below any
 * difference a person could enter, so it moves no value that is not at a half.
 */
const FLOAT_ERROR_TOLERANCE = 1e-9;

const roundedHalvesUp = (value: number): number => value * (1 + FLOAT_ERROR_TOLERANCE);

const writeGrams = (grams: number): string => formatGroupedGrams(roundedHalvesUp(grams));

const writeCount = (count: number): string => formatScaledCount(roundedHalvesUp(count));

/**
 * How much of an ingredient a scaled recipe holds, as the recipe view writes it. It reads as
 * `describeLoggedAmount` does ("750 g", "50 ml", "3 × 1 large (150 g)", "0.5 tbsp (7.5 ml)"), except that
 * a count of portions or spoons keeps two decimals ("0.25 tbsp", not "0.3 tbsp") and every g or ml, the
 * ones in brackets too, takes a thousands separator ("50,000 g"). A value at an exact half rounds up.
 */
export const describeScaledAmount = (amount: LoggedAmount): string => {
  if (amount.unit !== "portion" || amount.portion === null) {
    const unit = amount.unit === "portion" ? "g" : MEASURED_UNIT_NAMES[amount.unit];
    return `${writeGrams(amount.quantity)} ${unit}`;
  }
  const spoon = spoonPortionOf(amount.portion);
  if (spoon !== undefined) {
    const volume = `${writeGrams(amount.quantity * spoon.ml)} ml`;

    return `${writeCount(amount.quantity)} ${describePortionUnit(spoon.label, amount.quantity)} (${volume})`;
  }
  // A label that already says its size, such as "30 g", is not given it twice.
  const labelSaysItsSize =
    describePortionWithSize(amount.portion.label, {
      amount: roundedHalvesUp(amount.resolvedGrams),
      unit: "g",
    }) === amount.portion.label;
  const portion = labelSaysItsSize
    ? amount.portion.label
    : `${amount.portion.label} (${writeGrams(amount.resolvedGrams)} g)`;
  const count = writeCount(amount.quantity);

  return count === "1" ? portion : `${count} × ${portion}`;
};
