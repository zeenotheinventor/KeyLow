import { MUSCLE_ROLES } from "./enums";
import { MUSCLE_IDS } from "./muscles";

import type { MuscleRole } from "./enums";
import type { MuscleId } from "./muscles";

/*
 * What the "Muscles it works" sheet draws (KEY-741): an exercise's muscle map as values of the `role` scale
 * of the figure, and as the rows of the sheet. Pure under the ADR 0002 rule.
 */

/** A muscle of a map, as an exercise row or a set's snapshot writes it: both have these two fields. */
export type MuscleRoleEntry = Readonly<{ muscle_id: MuscleId; role: MuscleRole }>;

/** A role and the muscles that have it, in the order of the muscle list. */
export type MusclesOfRole = Readonly<{ role: MuscleRole; muscles: readonly MuscleId[] }>;

/**
 * The encoding of the `role` scale of the figure, the way `bodyMapValues` pins heat, volume and gap: a
 * muscle the exercise does not work is at rest, which is a muscle left out of the record. Pinned by a
 * test, so a change is deliberate.
 */
export const ROLE_FIGURE_VALUES = {
  stabiliser: 1,
  secondary: 2,
  primary: 3,
} as const satisfies Record<MuscleRole, number>;

/** The role of each muscle of the map, the stronger one when a muscle appears twice. */
const strongestRoles = (muscles: readonly MuscleRoleEntry[]): Map<MuscleId, MuscleRole> => {
  const strongest = new Map<MuscleId, MuscleRole>();
  for (const { muscle_id, role } of muscles) {
    const known = strongest.get(muscle_id);
    if (known === undefined || ROLE_FIGURE_VALUES[role] > ROLE_FIGURE_VALUES[known]) {
      strongest.set(muscle_id, role);
    }
  }
  return strongest;
};

/**
 * An exercise's muscle map as the values of the `role` scale. A muscle that is not in the map has no key.
 */
export const exerciseRoleValues = (
  muscles: readonly MuscleRoleEntry[],
): Partial<Record<MuscleId, number>> =>
  Object.fromEntries(
    [...strongestRoles(muscles)].map(([muscle, role]) => [muscle, ROLE_FIGURE_VALUES[role]]),
  );

/**
 * The rows of the sheet: the roles in the order primary, secondary, stabiliser, each with its muscles in
 * the order of the muscle list. A role with no muscles has no row.
 */
export const musclesByRole = (muscles: readonly MuscleRoleEntry[]): readonly MusclesOfRole[] => {
  const strongest = strongestRoles(muscles);
  return MUSCLE_ROLES.map((role) => ({
    role,
    muscles: MUSCLE_IDS.filter((muscle) => strongest.get(muscle) === role),
  })).filter((row) => row.muscles.length > 0);
};
