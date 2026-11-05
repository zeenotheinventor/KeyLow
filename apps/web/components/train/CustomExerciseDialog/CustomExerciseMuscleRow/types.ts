import type { MuscleId, MuscleRole } from "@keylow/core/training";

export type CustomExerciseMuscleRowProps = {
  muscle: MuscleId;
  role: MuscleRole;
  onChangeRole: (role: MuscleRole) => void;
  onRemove: () => void;
};
