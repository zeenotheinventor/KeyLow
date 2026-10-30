import type { TrainingFocus } from "@keylow/core/training";

export type FocusStepProps = {
  /** The chosen focuses, in the order they were chosen. Empty is an answer. */
  value: readonly TrainingFocus[];
  onChange: (focus: TrainingFocus[]) => void;
};
