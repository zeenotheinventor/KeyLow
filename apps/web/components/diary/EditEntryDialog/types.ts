export type EditEntryDialogProps = {
  /** The entry to edit. It is read from the day on view, so the dialog always shows the row the diary shows. */
  entryId: string;
  /** The day on view, `YYYY-MM-DD`, which the entry is on. */
  date: string;
  /** Called to close the dialog: Cancel, Close, Escape, Save and Delete. */
  onClose: () => void;
};
