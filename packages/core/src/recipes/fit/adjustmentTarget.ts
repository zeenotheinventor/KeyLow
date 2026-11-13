import type { FitNutrient, FitTarget } from "./types";
import type { NullableNutrients } from "../../schemas/nutrients";

export type AdjustmentChange = {
  nutrient: FitNutrient;
  mode: "add" | "multiply" | "set";
  value: number;
};

/**
 * Turns "30 g higher in protein" (`add 30`), "a third fewer carbs" (`multiply 0.667`) or "make it 600 kcal"
 * (`set 600`) into a per serving target, so no model does the arithmetic. The calories stay at the recipe's
 * own figure unless the change names them (Zee, 2026-11-13). A result below 0 is 0.
 *
 * Throws a `RangeError` for a value that is not finite, a `multiply` or `set` value below 0, and a
 * nutrient the recipe has no figure for. The messages state the rule and never the figures.
 */
export const adjustmentTarget = (
  perServing: NullableNutrients,
  change: AdjustmentChange,
): FitTarget => {
  const { nutrient, mode, value } = change;
  if (!Number.isFinite(value) || (mode !== "add" && value < 0)) {
    throw new RangeError("The change must be a finite number, and not below 0 unless it is added");
  }
  const original = perServing[nutrient];
  if (original === null) {
    throw new RangeError("The recipe has no figure for that nutrient");
  }
  const changed = { add: original + value, multiply: original * value, set: value }[mode];
  const target: FitTarget = {};
  if (nutrient !== "kcal" && perServing.kcal !== null) {
    target.kcal = perServing.kcal;
  }
  target[nutrient] = Math.max(0, changed);
  return target;
};
