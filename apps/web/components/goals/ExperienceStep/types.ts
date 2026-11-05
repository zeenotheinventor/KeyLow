import type { ExperienceLevel } from "@keylow/core/training";

export type ExperienceStepProps = {
  /** The level chosen, or `undefined` when none is chosen yet. */
  value: ExperienceLevel | undefined;
  onChange: (experience: ExperienceLevel) => void;
};
