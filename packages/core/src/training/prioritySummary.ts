import { TRAINING_FOCUSES } from "./enums";
import { MUSCLE_IDS } from "./muscles";
import { parseGoalAnswers } from "./parseGoalAnswers";
import { targetedMuscles } from "./targetedMuscles";

import type { PlanRoutine } from "./expandPlan";
import type { GoalAnswers } from "./goalAnswers";
import type { MusclePriority, MusclePriorityLevel } from "./goalPresets";
import type { MuscleId } from "./muscles";
import type { VolumeStatus } from "./muscleState";

/*
 * The data behind "Your priorities" (ADR 0005, "Goals and suggestions"), with no wording: the screen builds
 * its sentences from these groups. Pure under the ADR 0002 rule, and nothing in it is a tunable.
 */

/** The priority that comes first in the goal presets v1: a muscle at it is "first". */
const FIRST_PRIORITY: MusclePriorityLevel = 3;

/**
 * The volume status the body map draws for each group, so the small figures on the summary read the same
 * as the volume scale.
 */
export const PRIORITY_GROUP_VOLUME_STATUS = {
  first: "productive",
  keptUp: "maintaining",
  notTargeted: "not_targeted",
} as const satisfies Readonly<Record<string, VolumeStatus>>;

export type PrioritySummary = Readonly<{
  /** The muscles at the top priority, in the order of the muscle list. */
  first: readonly MuscleId[];
  /** The other muscles that are targeted, because the routine trains them or the goal ranks them above 0. */
  keptUp: readonly MuscleId[];
  /** The muscles neither the routine trains nor the goal ranks above 0. */
  notTargeted: readonly MuscleId[];
  /** The answers restated, with the focuses in the order of the focus list. */
  answers: GoalAnswers;
}>;

/**
 * The groups of "Your priorities" for a goal's answers and its `priority` (`deriveMusclePriority`, or the
 * saved `muscle_priority`), with the routine when the user has one. Every muscle is in exactly one group,
 * and the result is the same for any order the focuses were chosen in.
 *
 * Throws a `RangeError` stating the rule when the answers fail the questionnaire rules.
 */
export const summarisePriorities = (
  answers: GoalAnswers,
  priority: MusclePriority,
  routine?: PlanRoutine | null,
): PrioritySummary => {
  const restated = parseGoalAnswers(answers);
  const targeted = targetedMuscles({ routine: routine ?? null, priority });
  return {
    first: MUSCLE_IDS.filter((muscle) => priority[muscle] === FIRST_PRIORITY),
    keptUp: MUSCLE_IDS.filter(
      (muscle) => targeted.has(muscle) && priority[muscle] !== FIRST_PRIORITY,
    ),
    notTargeted: MUSCLE_IDS.filter((muscle) => !targeted.has(muscle)),
    answers: {
      ...restated,
      focus: TRAINING_FOCUSES.filter((focus) => restated.focus.includes(focus)),
    },
  };
};
