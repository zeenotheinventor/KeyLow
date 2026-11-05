import type { MuscleId } from "@keylow/core/training";

export type MuscleChooserProps = {
  /** The muscles the exercise already has, which are not offered again. */
  chosenMuscles: readonly MuscleId[];
  onChoose: (muscle: MuscleId) => void;
  onBack: () => void;
};
