import type { MuscleId } from "@keylow/core/training";

export type MuscleChooserDialogProps = {
  /** The muscles the exercise already has, which are not offered again. */
  chosenMuscles: readonly MuscleId[];
  onChoose: (muscle: MuscleId) => void;
  /** Steps back to the form, from Escape, Close and a press on the dimmed page. */
  onClose: () => void;
};
