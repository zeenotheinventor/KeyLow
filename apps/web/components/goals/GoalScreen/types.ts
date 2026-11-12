import type { TrainingGoalsRow } from "@keylow/core/schemas";

export type GoalScreenProps = {
  /** The goal that is stored. */
  goal: TrainingGoalsRow;
  /** Whether Train opened the page, which is where its Back button returns to. More otherwise. */
  isFromTrain: boolean;
};
