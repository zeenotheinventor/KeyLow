import type { EnteredNumber } from "@keylow/core/diary";

/**
 * What a field holds as a number for core's `validateTargets`: blank is null, a comma is read as a decimal
 * point, and text that is not a number is NaN, which the validator refuses.
 */
export function enteredNumber(text: string): EnteredNumber {
  const trimmed = text.trim();

  return trimmed === "" ? null : Number(trimmed.replace(",", "."));
}

/** A stored target written into a field: nothing for no target, else the number as it is. */
export const fieldText = (target: number | null): string => (target === null ? "" : String(target));
