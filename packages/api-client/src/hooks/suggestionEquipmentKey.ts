import type { Equipment } from "@keylow/core/training";

/**
 * The part of a suggestion library key that names the user's equipment: each piece once, sorted, and
 * joined with commas, so the same equipment in any order is the same key. It holds equipment values
 * only, never an exercise, a muscle, a priority or a time.
 */
export function suggestionEquipmentKey(equipment: readonly Equipment[]): string {
  return [...new Set(equipment)].sort().join(",");
}
