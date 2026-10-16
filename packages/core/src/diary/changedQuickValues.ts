/** A quick add's calories, macros (null for one that is not given) and label (null for none). */
export type QuickValues = {
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  label: string | null;
};

/**
 * What to write for a logged quick add from the values the form handed over, or undefined when the calories,
 * the macros and the label are all as logged. A macro is compared as given: a cleared one (null) is not a
 * 0 g one. When any of them changed, all five are handed over, since they are written as a whole.
 */
export function changedQuickValues(
  entry: {
    nutrients: { [Field in Exclude<keyof QuickValues, "label">]: QuickValues[Field] | null };
    snapshot: Pick<QuickValues, "label">;
  },
  values: QuickValues,
): QuickValues | undefined {
  const { nutrients, snapshot } = entry;
  const isChanged =
    values.kcal !== nutrients.kcal ||
    values.protein_g !== nutrients.protein_g ||
    values.carbs_g !== nutrients.carbs_g ||
    values.fat_g !== nutrients.fat_g ||
    values.label !== snapshot.label;

  return isChanged
    ? {
        kcal: values.kcal,
        protein_g: values.protein_g,
        carbs_g: values.carbs_g,
        fat_g: values.fat_g,
        label: values.label,
      }
    : undefined;
}
