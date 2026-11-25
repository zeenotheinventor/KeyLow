export type ResetLinkSentProps = {
  email: string;
  /** When the link was last sent, in epoch milliseconds. Send again unlocks a minute after it. */
  sentAt: number;
  isSending: boolean;
  onSendAgain: () => void;
};
