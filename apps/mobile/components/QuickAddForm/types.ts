/** What the form's fields hold as text: a blank is an empty string. */
export type QuickAddFormValues = {
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  label: string;
};

/** What the form hands over when Add or Save is pressed: the valid numbers, and the time the Time row shows. */
export type QuickAddSubmission = {
  kcal: number;
  /** Null for a macro left blank: unknown, never 0. */
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  /** Trimmed, and null when it was left blank. */
  label: string | null;
  /** The Time row's time as `HH:mm`. */
  time: string;
  /** The row still reads "Now": the person did not choose a time, so the time is the moment the screen opened. */
  isNow: boolean;
};

type QuickAddFormBaseProps = {
  /** The Time row's time as `HH:mm` when the form opens. */
  time: string;
  /** The row reads "Now · 12:40" and not "12:40", until the person chooses a time. */
  isNow: boolean;
  /** False while the connection is lost: Add, Save and Delete stop responding. */
  isOnline: boolean;
  /** Draws Add or Save as working and stops it responding. */
  isSaving: boolean;
  /** Shows that the last save was not saved. */
  hasSaveError: boolean;
  onSubmit: (submission: QuickAddSubmission) => void;
  /** Close on a new quick add, Back on a logged one. */
  onLeave: () => void;
};

/** A new quick add: empty fields to fill in, and Add. */
type QuickAddFormCreateProps = QuickAddFormBaseProps & {
  mode: "create";
};

/**
 * A logged quick add: its saved values, which cannot be changed (a quick add takes a new time only), and Save
 * with a Delete under it.
 */
type QuickAddFormEditProps = QuickAddFormBaseProps & {
  mode: "edit";
  initialValues: QuickAddFormValues;
  onDelete: () => void;
};

export type QuickAddFormProps = QuickAddFormCreateProps | QuickAddFormEditProps;
