import type { Ref } from "react";

/** The one notice the footer holds over the footnote. Offline replaces a failed save, and neither is shown with the other. */
export type ProgramEditNotice = "offline" | "save-failed" | null;

export type ProgramEditFooterProps = {
  notice: ProgramEditNotice;
  /** The newest expenditure estimate a save keeps, or null while there is none to name. */
  expenditureKcal: number | null;
  /** Save changes shows its spinner and takes no press. */
  isSaving: boolean;
  /** Save changes is dimmed and takes no press, as while offline. */
  isSaveOff: boolean;
  onSave: () => void;
  /** The footer's own element, which the form measures so it can keep focused controls clear of it. */
  ref: Ref<HTMLElement>;
  /** The Save changes button, which takes focus after a failed save. */
  saveButtonRef: Ref<HTMLButtonElement>;
};
