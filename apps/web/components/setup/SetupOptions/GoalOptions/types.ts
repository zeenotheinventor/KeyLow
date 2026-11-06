import type { SetupGoal } from "@keylow/core/setup";

export type GoalOptionsProps = {
  /** The group's accessible name, which is the question the cards answer. */
  label: string;
  /** The goals this person may choose. Any other goal is drawn disabled, with the reason it is not offered. */
  allowedGoals: readonly SetupGoal[];
  /** The chosen goal, or `undefined` while nothing is chosen. */
  value: SetupGoal | undefined;
  onChange: (goal: SetupGoal) => void;
};
