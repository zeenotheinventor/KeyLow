import { parseFormNumber } from "../../foods/foodForm";

import type { EnteredNumber } from "./validation";

/**
 * What a field holds as a number for core's `validateTargets`: blank is null, a comma is read as a decimal
 * comma only when one or two digits follow ("12,5"), and any other text is NaN, which the validator refuses.
 * That includes "1,200", whose comma is a thousands separator, and "1e3", "0x10" and "Infinity".
 */
export function enteredNumber(text: string): EnteredNumber {
  return parseFormNumber(text) ?? null;
}

/** A stored target written into a field: nothing for no target, else the number as it is. */
export const fieldText = (target: number | null): string => (target === null ? "" : String(target));
