import type { ActivityLevel } from "@keylow/core/engine";

export type ActivityStepProps = {
  /** The chosen level, or `undefined` while nothing is chosen. */
  value: ActivityLevel | undefined;
  onChange: (activity: ActivityLevel) => void;
};
