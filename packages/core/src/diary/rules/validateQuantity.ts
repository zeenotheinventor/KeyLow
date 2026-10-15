import { isUsableNumber } from "./validation";

import type { EnteredNumber, ValidationResult } from "./validation";

export type QuantityProblems = { quantity: "not_above_zero" };

/** The amount of a food to log must be a number above 0. */
export const validateQuantity = (
  quantity: EnteredNumber,
): ValidationResult<number, QuantityProblems> =>
  isUsableNumber(quantity) && quantity > 0
    ? { ok: true, value: quantity }
    : { ok: false, problems: { quantity: "not_above_zero" } };
