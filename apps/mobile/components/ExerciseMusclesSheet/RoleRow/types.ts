import type { MuscleId, MuscleRole } from "@keylow/core/training";

export type RoleRowProps = {
  role: MuscleRole;
  /** The muscles that have the role, in the order of the muscle list. */
  muscles: readonly MuscleId[];
  /** Draws the hairline above the row, for every row after the first. */
  hasDivider: boolean;
};
