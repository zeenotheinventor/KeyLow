import type { QuickAddFormValues } from "../components/QuickAddForm";
import type { QuickLogEntry } from "@keylow/api-client";

const numberText = (value: number | null): string => (value === null ? "" : String(value));

/** A logged quick add's saved numbers and label, as the quick add form's fields hold them. */
export function quickEntryValues(entry: QuickLogEntry): QuickAddFormValues {
  const { nutrients, snapshot } = entry;

  return {
    kcal: numberText(nutrients.kcal),
    protein: numberText(nutrients.protein_g),
    carbs: numberText(nutrients.carbs_g),
    fat: numberText(nutrients.fat_g),
    label: snapshot.label ?? "",
  };
}
