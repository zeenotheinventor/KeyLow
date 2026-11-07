// The user's current training goals, for "what am I training for?" and as the numbers a routine is built
// from. Only the current answers are read, with no history, and the row's user id never leaves the repo.
import { z } from "zod";

import { MUSCLE_IDS, MUSCLE_NAMES } from "../../core.ts";
import { getCurrentTrainingGoals } from "../../repos.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getTrainingGoalsInput = z.strictObject({});

export const getTrainingGoalsTool: ReadToolDefinition<z.infer<typeof getTrainingGoalsInput>> = {
  name: "get_training_goals",
  description:
    "Reads the user's current training goals: the goal, the focus, days a week, session minutes, " +
    "equipment, experience, and the muscles they want to train most, each with a priority from 1 to 3 " +
    "(1 keep up, 2 important, 3 first). Muscles with priority 0 are left out. Answers goals null when " +
    "the user has not answered the questions yet, and then ask them to set their goals in the app. " +
    dataNotice,
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
          goal: goals.goal,
          focus: goals.focus,
          days_per_week: goals.days_per_week,
          session_minutes: goals.session_minutes,
          equipment: goals.equipment,
          experience: goals.experience,
          muscle_priorities: MUSCLE_IDS.flatMap((muscle) => {
            const priority = goals.muscle_priority[muscle] ?? 0;
            return priority > 0 ? [{ muscle: MUSCLE_NAMES[muscle], priority }] : [];
          }),
        },
      },
    };
  },
};
