import type { SuggestionCardState } from "@keylow/api-client";

/** The card's offer, which the detail sheet shows the whole session of. */
export type SuggestionOfferState = Extract<SuggestionCardState, { status: "offer" }>;

export type SuggestionCardProps = {
  /** What `useSuggestionCard` gave. A hidden card draws nothing. */
  state: SuggestionCardState;
  /** Whether a session start is under way on the screen, which shows the spinner on Start and stops it responding. */
  isStarting?: boolean | undefined;
  /** Puts off the suggestion of the day given: "Not now". Drawn only when it is given. */
  onDismiss?: ((day: string) => void) | undefined;
  /** Opens the goal questionnaire: "Set your goal" on the no goal card. Drawn only when it is given. */
  onSetGoal?: (() => void) | undefined;
  /**
   * Opens the detail of the offer: the board's "See why" link on the card's heading. It is drawn only when it
   * is given and the offer holds its detail. The other states have no detail to open.
   */
  onOpenDetail?: (() => void) | undefined;
};
