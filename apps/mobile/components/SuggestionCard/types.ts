import type { SuggestionCardState } from "@keylow/api-client";

export type SuggestionCardProps = {
  /** What `useSuggestionCard` gave. A hidden card draws nothing. */
  state: SuggestionCardState;
  /** Puts off the suggestion of the day given: "Not now". Drawn only when it is given. */
  onDismiss?: ((day: string) => void) | undefined;
  /** Opens the goal questionnaire: "Set your goal" on the no goal card. Drawn only when it is given. */
  onSetGoal?: (() => void) | undefined;
};
