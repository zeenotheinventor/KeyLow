import { DAYS_PER_WEEK_OPTIONS, GOAL_QUESTIONS } from "@keylow/core/copy";

import type { DaysStepProps } from "./types";

import { ChipGroup } from "@/components/ui/ChipGroup";

// The chips are keyed by their text, since a chip group's values are strings.
const options = DAYS_PER_WEEK_OPTIONS.map((days) => ({ value: String(days), label: String(days) }));

// An empty string is the group's value while no day is chosen, since a chip group's value is a string.
/** The third question: 1 to 7 days a week. No chip is chosen until one is. */
export function DaysStep({ value, onChange }: DaysStepProps) {
  const chosen = DAYS_PER_WEEK_OPTIONS.find((days) => days === value);

  return (
    <ChipGroup
      label={GOAL_QUESTIONS.days.title}
      options={options}
      value={chosen === undefined ? "" : String(chosen)}
      onChange={(next) => {
        onChange(Number(next));
      }}
    />
  );
}
