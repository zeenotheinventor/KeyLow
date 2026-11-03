import type { AssistantCardLink, AssistantSheetThread } from "@keylow/core";

export type AssistantThreadProps = {
  thread: AssistantSheetThread;
  /** The person's IANA time zone, which the day limit's time is worded in. */
  timeZone: string;
  /** Sends your last message again, from the failed turn's notice. */
  onTryAgain: () => void;
  /** Sends your last message again, from the quick reply under an answer that was cut short. */
  onAskAgain: () => void;
  /** Opens what a card's link leads to. */
  onOpenCardLink: (target: AssistantCardLink["target"]) => void;
};
