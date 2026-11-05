export type DeleteSessionDialogProps = {
  /** The words of the question: its sets, its day and its date (`describeDeleteSessionBody`). */
  body: string;
  /** Where focus goes when the dialog closes: the Delete session control that opened it. */
  returnFocusTo: Element | null;
  /** Deletes the session. Resolves to whether it was deleted: when not, the dialog stays open. */
  onConfirm: () => Promise<boolean>;
  /** Called for Keep it, Escape, Close and a press on the dimmed page, and never while the delete is on its way. */
  onClose: () => void;
};
