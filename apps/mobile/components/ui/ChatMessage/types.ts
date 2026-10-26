/** The badge and the line beside it that mark an answer as an estimate, such as "Estimate" and "Trend weight is an estimate". */
export type ChatMessageEstimate = {
  /** The badge's word. */
  badgeLabel: string;
  /** The muted line beside the badge. */
  label: string;
};

type ChatMessageBaseProps = {
  /**
   * Who said it, as a screen reader hears it first, such as "You" or "Assistant". The boards draw no
   * such word, so the screen passes it with the rest of the copy.
   */
  speakerLabel: string;
  /** The words, one paragraph each. */
  paragraphs: readonly string[];
};

/** Your message: a bubble on the right of the conversation. It is only words. */
export type YourChatMessageProps = ChatMessageBaseProps & {
  role: "you";
  isStreaming?: never;
  stoppedLabel?: never;
  estimate?: never;
  citation?: never;
};

/** The assistant's message: plain paragraphs with no bubble, and the lines an answer can carry under them. */
export type AssistantChatMessageProps = ChatMessageBaseProps & {
  role: "assistant";
  /** Draws the accent caret after the last word, and makes the message a polite live region. */
  isStreaming?: boolean | undefined;
  /** The muted line under an answer that was cut short, such as "Stopped when you closed the assistant". */
  stoppedLabel?: string | undefined;
  /** The Estimate badge and its line, for an answer built on an estimate. */
  estimate?: ChatMessageEstimate | undefined;
  /** The muted caption with the database glyph that names the data an answer used. */
  citation?: string | undefined;
};

export type ChatMessageProps = YourChatMessageProps | AssistantChatMessageProps;
