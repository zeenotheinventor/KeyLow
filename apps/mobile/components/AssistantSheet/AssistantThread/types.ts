import type { AssistantCardLink, AssistantSheetThread } from "@keylow/core";

export type AssistantThreadProps = {
  thread: AssistantSheetThread;
  /** The person's IANA time zone, which the day limit's time is worded in. */
  timeZone: string;
  /** Sends your last message again, from the failed turn's notice. */
  onTryAgain: () => void;
  /** Sends your last message again, from the quick reply under an answer that was cut short. */
  onAskAgain: () => void;
  /** Sends the words of a quick reply or a confirm button as your message. */
  onAnswer: (words: string) => void;
  /** Opens what a card's link leads to. */
  onOpenCardLink: (target: AssistantCardLink["target"]) => void;
};
