import type { SuggestionNotices, TrainHome } from "@keylow/api-client";

export type TrainSuggestionCardProps = {
  /** The Train home the card sits on, which it works the day of its suggestion out from. */
  home: TrainHome;
  /** The toast for an add with Undo and for a failure. The route gives it, since the toast belongs to the app. */
  notices: SuggestionNotices;
  /** Opens the goal questionnaire: "Set your goal" on the no goal card. Drawn only when it is given. */
  onSetGoal?: (() => void) | undefined;
};
