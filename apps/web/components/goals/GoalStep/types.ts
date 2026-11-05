import type { TrainingGoal } from "@keylow/core/training";

export type GoalStepProps = {
  /** The chosen goal, or `undefined` when none is chosen yet. */
  value: TrainingGoal | undefined;
  onChange: (goal: TrainingGoal) => void;
};
