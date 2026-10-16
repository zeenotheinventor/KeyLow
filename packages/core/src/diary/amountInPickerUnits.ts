import { GRAMS_PER_OUNCE, ML_PER_FLUID_OUNCE } from "../nutrition/units";

import type { QuantityUnit } from "../nutrition/units";

/** A measured amount: grams, millilitres, ounces or fluid ounces. */
export type MeasuredAmount = { quantity: number; unit: Exclude<QuantityUnit, "portion"> };

/** Rounds to one decimal place, which is how far the picker and the edit screens show a converted amount. */
export const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

/**
 * The same amount in the units the portion picker offers, which are portions, grams and millilitres: ounces
 * come as grams and fluid ounces as millilitres, to a tenth. Grams and millilitres are as they are.
 */
export function amountInPickerUnits(amount: MeasuredAmount): {
  quantity: number;
  unit: "g" | "ml";
} {
  switch (amount.unit) {
    case "oz":
      return { quantity: roundToTenth(amount.quantity * GRAMS_PER_OUNCE), unit: "g" };
    case "fl_oz":
      return { quantity: roundToTenth(amount.quantity * ML_PER_FLUID_OUNCE), unit: "ml" };
    default:
      return { quantity: amount.quantity, unit: amount.unit };
  }
}
