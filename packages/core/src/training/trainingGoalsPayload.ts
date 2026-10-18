import { deriveMusclePriority } from "./goalPresets";

import type { GoalAnswers } from "./goalAnswers";
import type { GoalPresets, MusclePriority } from "./goalPresets";

/**
 * The `p_goals` argument of `save_training_goals` (ADR 0005, Amendment 1): the answers under the column
 * names, the priority of all 22 muscles with 0 for a muscle the goal does not target, and the version of
 * the presets it was derived with, so a retune never rewrites a past row. The database adds the owner and
 * the dates.
 */
export type TrainingGoalsPayload = GoalAnswers &
  Readonly<{
    muscle_priority: MusclePriority;
    params_version: string;
  }>;

export const trainingGoalsPayload = (
  answers: GoalAnswers,
  presets: GoalPresets,
): TrainingGoalsPayload => ({
  goal: answers.goal,
  focus: [...answers.focus],
  days_per_week: answers.days_per_week,
  session_minutes: answers.session_minutes,
  equipment: [...answers.equipment],
  experience: answers.experience,
  muscle_priority: deriveMusclePriority(answers, presets),
  params_version: presets.version,
});
