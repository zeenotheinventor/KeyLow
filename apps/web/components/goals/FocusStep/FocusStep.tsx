import { FOCUS_OPTIONS, GOAL_QUESTIONS } from "@keylow/core/copy";
import { TRAINING_FOCUSES } from "@keylow/core/training";

import type { FocusStepProps } from "./types";

import { OptionCardGroup } from "@/components/ui/OptionCard";

const options = TRAINING_FOCUSES.map((focus) => ({
  id: focus,
  title: FOCUS_OPTIONS[focus].label,
  description: FOCUS_OPTIONS[focus].description,
}));

/** The second question: any number of six focuses, or none. */
export function FocusStep({ value, onChange }: FocusStepProps) {
  return (
    <OptionCardGroup
      label={GOAL_QUESTIONS.focus.title}
      options={options}
      selection="multiple"
      value={value}
      onChange={onChange}
    />
  );
}
