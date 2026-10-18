/*
 * The enums of ADR 0005, Amendment 1 ("Enums"), and the focus list of "The numbers". The migrations
 * (KEY-347, KEY-348) create the same values in the same order. The muscle group and size class enums
 * are in `muscles.ts`, beside the list they describe.
 */

/** Shared by `exercises.equipment` and the `training_goals.equipment` array. */
export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
  "other",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

/** Where an exercise comes from: the imported library, or a user's own. */
export const EXERCISE_SOURCES = ["free_exercise_db", "user"] as const;

export type ExerciseSource = (typeof EXERCISE_SOURCES)[number];

export const EXERCISE_MECHANICS = ["compound", "isolation"] as const;

export type ExerciseMechanic = (typeof EXERCISE_MECHANICS)[number];

/** A muscle's part in an exercise. Every exercise has at least one `primary` muscle. */
export const MUSCLE_ROLES = ["primary", "secondary", "stabiliser"] as const;

export type MuscleRole = (typeof MUSCLE_ROLES)[number];

export const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;

export type SetType = (typeof SET_TYPES)[number];

export const TRAINING_GOALS = ["aesthetic", "strength", "hybrid"] as const;

export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** The values `training_goals.focus` may hold, each at most once. */
export const TRAINING_FOCUSES = ["v_taper", "chest", "arms", "glutes", "legs", "overall"] as const;

export type TrainingFocus = (typeof TRAINING_FOCUSES)[number];
