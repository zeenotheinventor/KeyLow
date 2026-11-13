import type { AssistantOpenedFrom } from "@keylow/core";

export type AssistantEmptyProps = {
  /** Sends the starter's words as your message. */
  onStarterPress: (words: string) => void;
  /** Turns the starters off, while the conversation is read again or the app is offline. */
  isDisabled: boolean;
  /** The Train pages, which have their own heading and starters. */
  from?: AssistantOpenedFrom | undefined;
};
