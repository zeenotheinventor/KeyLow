// The 22 muscle ids of ADR 0005 ("The muscle list is the contract"), in the ADR's order.
// This is the only copy inside packages/db. Core's MUSCLE_IDS (KEY-346) will become the single
// source; when it lands, this file re-exports it instead of listing the ids again.
export const MUSCLE_IDS = [
  "chest_upper",
  "chest_lower",
  "delt_front",
  "delt_side",
  "delt_rear",
  "lats",
  "traps_upper",
  "traps_mid",
  "lower_back",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "glute_max",
  "glute_med",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
  "tibialis",
  "neck",
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

const muscleIds: ReadonlySet<string> = new Set(MUSCLE_IDS);

export const isMuscleId = (value: string): value is MuscleId => muscleIds.has(value);

/** The roles of `exercise_muscles.role`, strongest first. */
export const ROLES = ["primary", "secondary", "stabiliser"] as const;

export type Role = (typeof ROLES)[number];

const roles: ReadonlySet<string> = new Set(ROLES);

export const isRole = (value: string): value is Role => roles.has(value);

/** The weight a role gets unless a documented rule or an override says otherwise (MAPPING.md). */
export const DEFAULT_WEIGHTS: Readonly<Record<Role, number>> = {
  primary: 1,
  secondary: 0.5,
  stabiliser: 0.2,
};
