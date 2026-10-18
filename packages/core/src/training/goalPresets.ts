import { MUSCLE_IDS } from "./muscles";
import { TRAINING_PARAMS_VERSION } from "./params";

import type { ExerciseMechanic, ExperienceLevel, TrainingFocus, TrainingGoal } from "./enums";
import type { GoalAnswers } from "./goalAnswers";
import type { MuscleId } from "./muscles";

/*
 * The goal presets v1 that Zee agreed on 2026-10-18 (Linear document "Goal presets and golden suggestions",
 * on KEY-396). A priority is a whole number from 0 to 3: 0 means the goal does not target the muscle, 1
 * keep up, 2 important, 3 first. Core treats a priority above 0 as "the goal targets it" (KEY-356).
 *
 * Under the purity and versioning rule of ADR 0002 and the "Consequences" of ADR 0005, a change to any
 * value below is a new version, never an edit of `keylow-training-v1` in place, because a stored
 * `muscle_priority` records the version it was derived with.
 */

/** 0 is not targeted, 1 keep up, 2 important, 3 first. */
export type MusclePriorityLevel = 0 | 1 | 2 | 3;

/** A priority for each of the 22 muscles. */
export type MusclePriority = Readonly<Record<MuscleId, MusclePriorityLevel>>;

/** The muscles a focus raises. A muscle left out is not raised by it. */
export type FocusOverlay = Readonly<Partial<Record<MuscleId, MusclePriorityLevel>>>;

/** The reps and effort an exercise the app suggests is given. */
export type ExerciseTarget = Readonly<{ repMin: number; repMax: number; targetRir: number }>;

export type GoalPresets = Readonly<{
  version: typeof TRAINING_PARAMS_VERSION;
  /** What a goal ranks before any focus. The hybrid base is the higher of the aesthetic and strength bases. */
  basePriority: Readonly<Record<TrainingGoal, MusclePriority>>;
  /** What each focus raises. `overall` raises nothing. */
  focusPriority: Readonly<Record<TrainingFocus, FocusOverlay>>;
  /** Reps and target RIR for a suggested exercise, by goal and by the exercise's mechanic. */
  exerciseTargets: Readonly<
    Record<TrainingGoal, Readonly<Record<ExerciseMechanic, ExerciseTarget>>>
  >;
  /** Sets for each suggested exercise, by experience, the same for every goal. */
  setsPerExercise: Readonly<Record<ExperienceLevel, number>>;
}>;

export const GOAL_PRESETS_V1: GoalPresets = {
  version: TRAINING_PARAMS_VERSION,
  basePriority: {
    aesthetic: {
      chest_upper: 2,
      chest_lower: 2,
      delt_front: 1,
      delt_side: 2,
      delt_rear: 2,
      lats: 2,
      traps_upper: 0,
      traps_mid: 2,
      lower_back: 1,
      biceps: 2,
      triceps: 2,
      forearms: 1,
      abs: 0,
      obliques: 0,
      glute_max: 2,
      glute_med: 0,
      quads: 2,
      hamstrings: 2,
      adductors: 0,
      calves: 1,
      tibialis: 0,
      neck: 0,
    },
    strength: {
      chest_upper: 1,
      chest_lower: 3,
      delt_front: 3,
      delt_side: 1,
      delt_rear: 1,
      lats: 1,
      traps_upper: 1,
      traps_mid: 1,
      lower_back: 3,
      biceps: 1,
      triceps: 1,
      forearms: 1,
      abs: 0,
      obliques: 0,
      glute_max: 3,
      glute_med: 0,
      quads: 3,
      hamstrings: 3,
      adductors: 0,
      calves: 0,
      tibialis: 0,
      neck: 0,
    },
    hybrid: {
      chest_upper: 2,
      chest_lower: 3,
      delt_front: 3,
      delt_side: 2,
      delt_rear: 2,
      lats: 2,
      traps_upper: 1,
      traps_mid: 2,
      lower_back: 3,
      biceps: 2,
      triceps: 2,
      forearms: 1,
      abs: 0,
      obliques: 0,
      glute_max: 3,
      glute_med: 0,
      quads: 3,
      hamstrings: 3,
      adductors: 0,
      calves: 1,
      tibialis: 0,
      neck: 0,
    },
  },
  focusPriority: {
    v_taper: { chest_upper: 3, delt_side: 3, delt_rear: 2, lats: 3, traps_mid: 2 },
    chest: { chest_upper: 3, chest_lower: 3 },
    arms: { biceps: 3, triceps: 3, forearms: 2 },
    glutes: { glute_max: 3, glute_med: 3 },
    legs: { quads: 3, hamstrings: 3, adductors: 2, calves: 3 },
    overall: {},
  },
  exerciseTargets: {
    aesthetic: {
      compound: { repMin: 8, repMax: 10, targetRir: 2 },
      isolation: { repMin: 12, repMax: 15, targetRir: 1 },
    },
    strength: {
      compound: { repMin: 3, repMax: 5, targetRir: 2 },
      isolation: { repMin: 8, repMax: 12, targetRir: 2 },
    },
    hybrid: {
      compound: { repMin: 5, repMax: 8, targetRir: 2 },
      isolation: { repMin: 10, repMax: 15, targetRir: 1 },
    },
  },
  setsPerExercise: { beginner: 2, intermediate: 3, advanced: 4 },
};

/**
 * The priority of each of the 22 muscles for a goal and its focuses: the goal's base, raised by every
 * chosen focus, with the highest priority per muscle winning. `overall` and an empty focus raise nothing,
 * so they leave the goal's base as it is, and the order the focuses are chosen in does not matter.
 */
export const deriveMusclePriority = (
  { goal, focus }: Pick<GoalAnswers, "goal" | "focus">,
  presets: GoalPresets,
): MusclePriority =>
  // Every id of the list is mapped, so the entries make the full record.
  Object.fromEntries(
    MUSCLE_IDS.map((muscle) => [
      muscle,
      Math.max(
        presets.basePriority[goal][muscle],
        ...focus.map((chosen) => presets.focusPriority[chosen][muscle] ?? 0),
      ),
    ]),
  ) as MusclePriority;

/**
 * The muscles a priority ranks above 0, in the order of the list: what the goal targets, for
 * `targetedMuscles({ routine, priority })`.
 */
export const goalTargetedMuscles = (
  priority: Readonly<Partial<Record<MuscleId, number>>>,
): ReadonlySet<MuscleId> => new Set(MUSCLE_IDS.filter((muscle) => (priority[muscle] ?? 0) > 0));
