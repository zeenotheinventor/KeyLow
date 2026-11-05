import type { ExperienceLevel } from "@keylow/core/training";

export type ExperienceStepProps = {
  /** The chosen level, or `undefined` while none is. */
  value: ExperienceLevel | undefined;
  onChange: (level: ExperienceLevel) => void;
};
