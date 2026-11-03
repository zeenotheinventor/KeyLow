export type AssistantEmptyProps = {
  /** Sends the starter's words as your message. */
  onStarterPress: (words: string) => void;
  /** Dims the starters and stops them responding, while the assistant cannot be reached. */
  isDisabled: boolean;
};
