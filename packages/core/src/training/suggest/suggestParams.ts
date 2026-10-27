import { GOAL_PRESETS_V1 } from "../goalPresets";
import { TRAINING_PARAMS_V2, TRAINING_PARAMS_VERSION_V2 } from "../params";
import { SESSION_TIME_PARAMS_V1 } from "../sessionTime";

import type { GoalPresets } from "../goalPresets";
import type { TrainingParams } from "../params";
import type { SessionTimeParams } from "../sessionTime";

/*
 * The tunables of `suggestSession` (ADR 0005, "Goals and suggestions"). Like `COMPARE_PARAMS_V2` they sit
 * in their own object, carrying the training params version, so the presets, the heat model and the
 * session length keep their own pinned objects and this one only adds what the suggestion itself decides.
 * A change to any value is a new version, never an edit of this one, because a suggestion records the
 * version it was made with (ADR 0002).
 */

/**
 * How equal exercises are told apart, in the order they are tried: a higher exercise score first, then a
 * compound before an isolation, then the name, then the id.
 */
export type ExerciseTieBreak = "exercise_score" | "compound_first" | "name" | "id";

export type SuggestParams = Readonly<{
  version: typeof TRAINING_PARAMS_VERSION_V2;
  /** The heat and volume numbers a muscle's score is read with. */
  training: TrainingParams;
  /** The sets per suggested exercise (by experience) and its reps and target RIR (by goal and mechanic). */
  presets: GoalPresets;
  /** The session length an addition has to fit in. */
  sessionTime: SessionTimeParams;
  /** An exercise with a primary muscle whose heat is above this is skipped. Exactly this passes. */
  hotHeatThreshold: number;
  /** The most exercises a fresh suggestion holds, and the most added to a day the user has planned. */
  maxExercises: Readonly<{ fresh: number; addedToPlannedDay: number }>;
  exerciseTieBreak: readonly ExerciseTieBreak[];
}>;

/** The values Zee agreed on KEY-396 (Part 3): hot above 0.5, 8 exercises fresh and 2 added to a planned day. */
export const SUGGEST_PARAMS_V2: SuggestParams = {
  version: TRAINING_PARAMS_VERSION_V2,
  training: TRAINING_PARAMS_V2,
  presets: GOAL_PRESETS_V1,
  sessionTime: SESSION_TIME_PARAMS_V1,
  hotHeatThreshold: 0.5,
  maxExercises: { fresh: 8, addedToPlannedDay: 2 },
  exerciseTieBreak: ["exercise_score", "compound_first", "name", "id"],
};
