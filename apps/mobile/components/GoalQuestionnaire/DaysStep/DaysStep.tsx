import { DAYS_PER_WEEK_OPTIONS, GOAL_QUESTIONS } from "@keylow/core/copy";

import { ChipGroup } from "../../ui";

import type { DaysStepProps } from "./types";

// The chips are keyed by their text, since a chip group's values are strings.
const options = DAYS_PER_WEEK_OPTIONS.map((days) => ({ value: String(days), label: String(days) }));

/**
 * The third question: 1 to 7 days a week. The board draws the seven chips 44 points high in one line, which
 * is the equal layout.
 */
export function DaysStep({ value, onChange }: DaysStepProps) {
  const chosen = DAYS_PER_WEEK_OPTIONS.find((days) => days === value);

  return (
    <ChipGroup
      label={GOAL_QUESTIONS.days.title}
      layout="equal"
      options={options}
      value={chosen === undefined ? null : String(chosen)}
      onChange={(next: string) => {
        onChange(Number(next));
      }}
    />
  );
}
