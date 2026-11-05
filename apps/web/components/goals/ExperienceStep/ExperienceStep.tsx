import { EXPERIENCE_OPTIONS, GOAL_QUESTIONS } from "@keylow/core/copy";
import { EXPERIENCE_LEVELS } from "@keylow/core/training";

import type { ExperienceStepProps } from "./types";

import { OptionCardGroup } from "@/components/ui/OptionCard";

const options = EXPERIENCE_LEVELS.map((level) => ({
  id: level,
  title: EXPERIENCE_OPTIONS[level].label,
  description: EXPERIENCE_OPTIONS[level].description,
}));

/** The sixth question: how long the person has trained. One of three, none chosen on a first run. */
export function ExperienceStep({ value, onChange }: ExperienceStepProps) {
  return (
    <OptionCardGroup
      label={GOAL_QUESTIONS.experience.title}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
