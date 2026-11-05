import type { MuscleId, MuscleRole } from "@keylow/core/training";

export type RoleRowProps = {
  role: MuscleRole;
  muscles: readonly MuscleId[];
  /** Whether a line separates the row from the one above it. */
  hasDivider: boolean;
};
