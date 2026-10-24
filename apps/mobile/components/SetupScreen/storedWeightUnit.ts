import type { WeightUnit } from "@keylow/core/format";

/**
 * The profile's stored weight unit as `startingPlan` takes it. The database keeps the unit as plain
 * text, so text that is not a weight unit reads as nothing stored, as the wizard's own unit does.
 */
export function storedWeightUnitOf(storedText: string | null): WeightUnit | null {
  return storedText === "kg" || storedText === "lb" || storedText === "st" ? storedText : null;
}
