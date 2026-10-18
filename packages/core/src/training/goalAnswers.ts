import { z } from "zod";

import {
  MAX_DAYS_PER_WEEK,
  MAX_SESSION_MINUTES,
  MIN_DAYS_PER_WEEK,
  MIN_SESSION_MINUTES,
} from "./bounds";
import { EQUIPMENT, EXPERIENCE_LEVELS, TRAINING_FOCUSES, TRAINING_GOALS } from "./enums";

/*
 * What the goal questionnaire asks (ADR 0005, "Goals and suggestions", and Amendment 1, `training_goals`).
 * The keys are the column names, so the answers and the `save_training_goals` payload read alike. Messages
 * state the rule and never quote a value, because a goal answer is health data and must not reach a log.
 * "Full gym" is a screen shortcut for every equipment value but `other`, not a value of its own.
 */

const wholeNumberBetween = (minimum: number, maximum: number, message: string) =>
  z
    .number({ error: message })
    .refine((value) => Number.isInteger(value) && value >= minimum && value <= maximum, {
      error: message,
    });

export const goalAnswersSchema = z.object({
  goal: z.enum(TRAINING_GOALS, { error: "The goal must be one of the goal list" }),
  /** May be empty: a strength user can choose no focus. */
  focus: z
    .array(z.enum(TRAINING_FOCUSES, { error: "Each focus must be one of the focus list" }))
    .refine((focus) => new Set(focus).size === focus.length, {
      error: "A focus can be chosen at most once",
    }),
  days_per_week: wholeNumberBetween(
    MIN_DAYS_PER_WEEK,
    MAX_DAYS_PER_WEEK,
    `Days per week must be a whole number from ${MIN_DAYS_PER_WEEK} to ${MAX_DAYS_PER_WEEK}`,
  ),
  session_minutes: wholeNumberBetween(
    MIN_SESSION_MINUTES,
    MAX_SESSION_MINUTES,
    `Session minutes must be a whole number from ${MIN_SESSION_MINUTES} to ${MAX_SESSION_MINUTES}`,
  ),
  equipment: z.array(
    z.enum(EQUIPMENT, { error: "Each equipment must be one of the equipment list" }),
  ),
  experience: z.enum(EXPERIENCE_LEVELS, {
    error: "The experience must be one of the experience list",
  }),
});

export type GoalAnswers = z.infer<typeof goalAnswersSchema>;
