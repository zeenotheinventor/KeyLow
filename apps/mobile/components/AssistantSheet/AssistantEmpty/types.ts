import type { AssistantOpenedFrom } from "@keylow/core";

export type AssistantEmptyProps = {
  /** Sends the starter's words as your message. */
  onStarterPress: (words: string) => void;
  /** Dims the starters and stops them responding, while the assistant cannot be reached. */
  isDisabled: boolean;
  /** The time Describe logs at, when the sheet was opened from Log food: its intro is drawn in place of the starters. */
  describeAt?: string | undefined;
  /** The screen whose header opened the sheet, when it was not the diary's: Train has its own heading and starters. */
  from?: AssistantOpenedFrom | undefined;
};
