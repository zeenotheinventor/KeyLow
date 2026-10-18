export { MUSCLE_IDS, isMuscleId } from "@keylow/core";
export type { MuscleId } from "@keylow/core";

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
