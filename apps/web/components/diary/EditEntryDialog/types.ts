export type EditEntryDialogProps = {
  /** The entry to edit. It is read from the day on view, so the dialog always shows the row the diary shows. */
  entryId: string;
  /** The day on view, `YYYY-MM-DD`, which the entry is on. */
  date: string;
  /**
   * The control the first dialog was opened from, which focus goes back to when this one closes. It is the
   * diary's hour plus, Edit button or the top bar's search, and not whatever was focused inside a dialog before.
   */
  opener: Element | null;
  /** Called to close the dialog: Cancel, Close, Escape, Save and Delete. */
  onClose: () => void;
};
