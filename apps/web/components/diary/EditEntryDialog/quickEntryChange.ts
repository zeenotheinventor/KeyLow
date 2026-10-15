import type { QuickEntryValues, QuickLogEntry } from "@keylow/api-client";
import type { ValidQuickAdd } from "@keylow/core/diary";

/**
 * What to write for a logged quick add from the checked fields, or undefined when the calories, the macros
 * and the label are all as logged. A macro is compared as given: a cleared one (null) is not a 0 g one. When
 * any of them changed, all five are handed over, since they are written as a whole.
 */
export function quickEntryChange(
  entry: QuickLogEntry,
  value: ValidQuickAdd,
): QuickEntryValues | undefined {
  const { nutrients, snapshot } = entry;
  const isChanged =
    value.kcal !== nutrients.kcal ||
    value.protein_g !== nutrients.protein_g ||
    value.carbs_g !== nutrients.carbs_g ||
    value.fat_g !== nutrients.fat_g ||
    value.label !== snapshot.label;

  return isChanged
    ? {
        kcal: value.kcal,
        protein_g: value.protein_g,
        carbs_g: value.carbs_g,
        fat_g: value.fat_g,
        label: value.label,
      }
    : undefined;
}
