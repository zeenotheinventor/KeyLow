/** The words of the quick add form that no other screen shares, as the quick add boards draw them. */
export const QUICK_ADD_FORM = {
  title: "Quick add",
  /** The title of the form on an entry that is already logged. */
  editTitle: "Edit quick add",
  /** The name of the header's control on the new form. The edit form has Back, which every back control shares. */
  close: "Close",
  caloriesLabel: "Calories",
  labelLabel: "Label (optional)",
  labelPlaceholder: "For example, meal deal crisps",
};

/** The name of a macro field of the quick add form: "Protein in grams". */
export const describeQuickAddMacroField = (macroName: string): string => `${macroName} in grams`;
