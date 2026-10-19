import type { Equipment, MuscleId } from "@keylow/core/training";

export type ExerciseRowProps = {
  name: string;
  equipment: Equipment;
  /** The person's own exercise: draws the Custom pill. */
  isCustom: boolean;
  /** The muscles the exercise works as primary, strongest first. Up to two chips are drawn from the primary and then the secondary. */
  primaryMuscles: readonly MuscleId[];
  secondaryMuscles: readonly MuscleId[];
  /** Adds the exercise. The whole row is the button. */
  onPress: () => void;
};
