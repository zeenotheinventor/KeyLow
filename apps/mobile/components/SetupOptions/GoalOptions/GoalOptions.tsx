import { SETUP_GOAL_NOT_OFFERED_UNDER_18, SETUP_GOAL_OPTIONS } from "@keylow/core/copy";
import { GOALS } from "@keylow/core/setup";

import { OptionCardGroup } from "../../ui";

import type { GoalOptionsProps } from "./types";

/**
 * Lose, Maintain and Gain weight. A goal that is not allowed keeps its title and swaps its line of words
 * for the reason, and the card does not respond.
 */
export function GoalOptions({ label, allowedGoals, value, onChange }: GoalOptionsProps) {
  const options = GOALS.map((goal) => ({
    id: goal,
    title: SETUP_GOAL_OPTIONS[goal].title,
    ...(allowedGoals.includes(goal)
      ? { description: SETUP_GOAL_OPTIONS[goal].description }
      : { disabledReason: SETUP_GOAL_NOT_OFFERED_UNDER_18 }),
  }));

  return <OptionCardGroup label={label} options={options} value={value} onChange={onChange} />;
}
