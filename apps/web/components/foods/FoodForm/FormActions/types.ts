export type FormActionsProps = {
  /** What the save button says: Create food, Save to your foods or Save changes. */
  submitLabel: string;
  /** Where Cancel leads. */
  cancelHref: string;
  /** The save is running. The button shows a spinner and does nothing until it ends. */
  isSaving: boolean;
  /** The save is not offered, because repeating it would do harm. */
  isSaveDisabled: boolean;
};
