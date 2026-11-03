import type { AssistantSheetThread } from "@keylow/core";

export type AssistantThreadProps = {
  thread: AssistantSheetThread;
  /** Sends your last message again, from the failed turn's notice. */
  onTryAgain: () => void;
  /** Sends your last message again, from the quick reply under an answer that was cut short. */
  onAskAgain: () => void;
};
