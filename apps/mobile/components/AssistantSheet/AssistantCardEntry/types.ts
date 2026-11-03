import type { AssistantCard, AssistantCardLink } from "@keylow/core";

export type AssistantCardEntryProps = {
  card: AssistantCard;
  /** Opens what the card's link leads to. The sheet closes itself first. */
  onOpenLink: (target: AssistantCardLink["target"]) => void;
};
