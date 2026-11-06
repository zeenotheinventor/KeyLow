import type { SetupGoal } from "@keylow/core/setup";

export type GoalStepProps = {
  /** The chosen goal, or `undefined` while nothing is chosen. */
  value: SetupGoal | undefined;
  /** The goals this person may choose. Lose is missing under 18, and that is what the note under the cards follows. */
  allowedGoals: readonly SetupGoal[];
  onChange: (goal: SetupGoal) => void;
};
