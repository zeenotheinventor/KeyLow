// The `muscles` field of the curated CSV: `id:role:weight` entries joined by `;`, for example
// `delt_side:primary:1.0;traps_upper:secondary:0.5`. Parsing is lenient about the values, so the
// checker can say what is wrong with them; formatting is strict and always gives the same text.
import { MUSCLE_IDS, ROLES } from "./muscles";

import type { MuscleId, Role } from "./muscles";

export interface MuscleShare {
  muscle: MuscleId;
  role: Role;
  weight: number;
}

/** One entry as written, before its id, role and weight are known to be valid. */
export interface RawMuscleShare {
  muscle: string;
  role: string;
  weight: string;
}

export function parseMuscleShares(text: string): RawMuscleShare[] {
  if (text === "") {
    return [];
  }
  return text.split(";").map((entry) => {
    const parts = entry.split(":");
    if (parts.length !== 3) {
      throw new Error("a muscle share must be written id:role:weight");
    }
    const [muscle = "", role = "", weight = ""] = parts;
    return { muscle, role, weight };
  });
}

/** A weight with at least one decimal and at most two: 1 is `1.0`, 0.25 is `0.25`. */
export function formatShareWeight(weight: number): string {
  const text = String(Math.round(weight * 100) / 100);
  return text.includes(".") ? text : `${text}.0`;
}

const roleRank = (role: Role): number => ROLES.indexOf(role);
const muscleRank = (muscle: MuscleId): number => MUSCLE_IDS.indexOf(muscle);

/** Primary first, then secondary, then stabiliser; heavier first within a role; then the ADR's muscle order. */
export function sortMuscleShares(shares: readonly MuscleShare[]): MuscleShare[] {
  return [...shares].sort(
    (first, second) =>
      roleRank(first.role) - roleRank(second.role) ||
      second.weight - first.weight ||
      muscleRank(first.muscle) - muscleRank(second.muscle),
  );
}

export const formatMuscleShares = (shares: readonly MuscleShare[]): string =>
  sortMuscleShares(shares)
    .map(({ muscle, role, weight }) => `${muscle}:${role}:${formatShareWeight(weight)}`)
    .join(";");
