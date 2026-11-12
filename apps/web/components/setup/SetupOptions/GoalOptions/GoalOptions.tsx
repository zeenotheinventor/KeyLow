import { setupGoalCardsFor } from "@keylow/core/copy";

import type { GoalOptionsProps } from "./types";

import { OptionCardGroup } from "@/components/ui/OptionCard";

/**
 * Lose, Maintain and Gain weight. A goal that is not allowed keeps its title and swaps its line of words
 * for the reason, and the card does not respond.
 */
export function GoalOptions({ label, allowedGoals, value, onChange }: GoalOptionsProps) {
  const options = setupGoalCardsFor(allowedGoals).map(({ goal, ...words }) => ({
    id: goal,
    ...words,
  }));

  return <OptionCardGroup label={label} options={options} value={value} onChange={onChange} />;
}
