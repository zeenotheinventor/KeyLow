export type ConfirmButtonsProps = {
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` draws the confirm button in the danger fill, as for deleting several entries. Else it is the accent. */
  tone: "danger" | "primary";
  /** Once the next message is sent the buttons are drawn but no longer respond. */
  isAnswered: boolean;
  /** Sends the pressed button's words as your message. */
  onAnswer: (words: string) => void;
};
