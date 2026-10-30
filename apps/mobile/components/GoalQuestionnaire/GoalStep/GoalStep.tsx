import { GOAL_OPTIONS, GOAL_QUESTIONS } from "@keylow/core/copy";
import { TRAINING_GOALS } from "@keylow/core/training";

import { OptionCardGroup } from "../../ui";

import type { GoalStepProps } from "./types";

const options = TRAINING_GOALS.map((goal) => ({
  id: goal,
  title: GOAL_OPTIONS[goal].label,
  description: GOAL_OPTIONS[goal].description,
}));

/** The first question: what the person trains for. One of three, none chosen on a first run. */
export function GoalStep({ value, onChange }: GoalStepProps) {
  return (
    <OptionCardGroup
      label={GOAL_QUESTIONS.goal.title}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
