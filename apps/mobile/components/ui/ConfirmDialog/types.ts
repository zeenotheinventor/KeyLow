import type { ReactNode } from "react";

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
  /**
   * Names the confirm button for a screen reader while `busy`, in place of its label, such as "Deleting your
   * account" for a button that shows only a spinner. Without it the button keeps its label as its name.
   */
  confirmBusyLabel?: string | undefined;
  /**
   * Makes the dialog impossible to dismiss while `busy`: the dim, the screen reader's escape gesture and the
   * Android back button do nothing, and the cancel button is disabled. For a step that cannot be left once
   * it has started. Defaults to `false`, and has no effect when the dialog is not busy.
   */
  lockWhileBusy?: boolean | undefined;
  /**
   * Drawn between the body and the buttons, for a field the answer needs, such as the password a deletion asks
   * for. With it the card moves up to stay clear of the keyboard, and the gap above the buttons gives way to
   * the field's own. Defaults to nothing, which leaves the card as every other dialog draws it.
   */
  children?: ReactNode | undefined;
  onConfirm: () => void;
  /**
   * Called when the user backs out, by the cancel button or by a press on the dim, the screen reader's
   * escape gesture or the Android back button. It is not called when the screen closes the dialog itself.
   */
  onCancel: () => void;
};
