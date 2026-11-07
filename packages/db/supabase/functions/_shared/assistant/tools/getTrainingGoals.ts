// The user's current training goals, for "what am I training for?" and as the numbers a routine is built
// from. Only the current answers are read, with no history, and the row's user id never leaves the repo.
// The answers are given in the words the app shows, except the equipment, whose codes feed
// `search_exercises`. Nothing in the result is text a person wrote, so the description has no data notice.
import { z } from "zod";

import {
  EXPERIENCE_OPTIONS,
  FOCUS_OPTIONS,
  GOAL_OPTIONS,
  MUSCLE_IDS,
  MUSCLE_NAMES,
} from "../../core.ts";
import { getCurrentTrainingGoals } from "../../repos.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getTrainingGoalsInput = z.strictObject({});

export const getTrainingGoalsTool: ReadToolDefinition<z.infer<typeof getTrainingGoalsInput>> = {
  name: "get_training_goals",
  description:
    "Reads the user's current training goals: goal, focus, days a week, session minutes, equipment, " +
    "experience, and the muscles they train most with a priority (1 keep up, 2 important, 3 first, " +
    "the others left out). Answers goals null before the user has answered, then suggest setting " +
    "them in the app.",
  kind: "read",
  input: getTrainingGoalsInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx) {
    const goals = await getCurrentTrainingGoals(ctx.caller);
    if (goals === null) {
      return { data: { goals: null } };
    }
    return {
      data: {
        goals: {
          goal: GOAL_OPTIONS[goals.goal].label,
          focus: goals.focus.map((focus) => FOCUS_OPTIONS[focus].label),
          days_per_week: goals.days_per_week,
          session_minutes: goals.session_minutes,
          equipment: goals.equipment,
          experience: EXPERIENCE_OPTIONS[goals.experience].label,
          muscle_priorities: MUSCLE_IDS.flatMap((muscle) => {
            const priority = goals.muscle_priority[muscle] ?? 0;
            return priority > 0 ? [{ muscle: MUSCLE_NAMES[muscle], priority }] : [];
          }),
        },
      },
    };
  },
};
