export type ConfirmDialogTone = "destructive" | "primary";

export type ConfirmDialogProps = {
  open: boolean;
  /** Names the dialog and is its heading: a question, such as "Discard this session?". */
  title: string;
  /** One sentence saying what the answer does. */
  body: string;
  /** The confirm button, drawn first: what happens, such as "Discard session". */
  confirmLabel: string;
  /** The button that backs out, drawn second, such as "Keep logging". */
  cancelLabel: string;
  /**
   * Destructive for an answer that removes something: the confirm button is drawn in the danger colour and
   * the cancel button is the main one. Primary for one that only changes what is current: the confirm
   * button is the main one.
   */
  tone: ConfirmDialogTone;
  /** Shows a spinner on the confirm button and stops it responding, while the answer is being carried out. */
  busy?: boolean | undefined;
  onConfirm: () => void;
  /**
   * Called when the user backs out, by the cancel button or by a press on the dim, the screen reader's
   * escape gesture or the Android back button. It is not called when the screen closes the dialog itself.
   */
  onCancel: () => void;
};
