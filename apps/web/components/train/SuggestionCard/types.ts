import type { SuggestionCardState } from "@keylow/api-client";

/** The card's offer, which is the state that holds the words and the buttons. */
export type SuggestionOfferState = Extract<SuggestionCardState, { status: "offer" }>;

export type SuggestionCardProps = {
  /** What `useSuggestionCard` gave. A hidden card draws nothing. */
  state: SuggestionCardState;
  /** Puts off the suggestion of the day given: "Not now". Drawn only when it is given. */
  onDismiss?: ((day: string) => void) | undefined;
  /** Opens the goal questionnaire: "Set your goal" on the no goal card. Drawn only when it is given. */
  onSetGoal?: (() => void) | undefined;
};
