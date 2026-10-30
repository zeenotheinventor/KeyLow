import type { TrainingGoal } from "@keylow/core/training";

export type GoalStepProps = {
  /** The chosen goal, or `undefined` while none is. */
  value: TrainingGoal | undefined;
  onChange: (goal: TrainingGoal) => void;
};
