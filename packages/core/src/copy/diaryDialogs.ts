/** The words of the time field and its picker, as the web boards draw them. The field's own label is `TIME_ROW_LABEL`. */
export const TIME_FIELD = {
  /** The helper under the field while the time is still the moment the dialog opened. */
  nowHelper: "Now",
  /** The picker's name as a dialog. */
  pickerName: "Choose a time",
  hours: "Hours",
  minutes: "Minutes",
  done: "Done",
};

/** The words of the web add food dialog. The search rows, the portion step and the toast use the shared copy. */
export const ADD_FOOD_DIALOG = {
  title: "Add food",
  searchLabel: "Search foods",
  /** The link from the portion step back to the search results. */
  backToResults: "Results",
  cancel: "Cancel",
};

/** The words of the web edit entry dialog. */
export const EDIT_ENTRY_DIALOG = {
  title: "Edit entry",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
};

/**
 * The words of the web quick add dialog that the shared `QUICK_ADD_FORM` does not have: the macro labels, always
 * protein, carbohydrate, fat, and the footer buttons. Its title, Calories and Label come from `QUICK_ADD_FORM`.
 */
export const QUICK_ADD_DIALOG = {
  protein: "Protein",
  carbs: "Carbohydrate",
  fat: "Fat",
  add: "Add",
  cancel: "Cancel",
};
