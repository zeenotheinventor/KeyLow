export type ConfirmButtonsProps = {
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` draws the confirm button in the danger fill, as for deleting several entries. Else it is the accent. */
  tone: "danger" | "primary";
  /** Dims both buttons and stops them responding, while a message cannot be sent (offline, an answer arriving, the thread being read again). */
  isDisabled: boolean;
  /** Sends the pressed button's words as your message. */
  onAnswer: (words: string) => void;
};
