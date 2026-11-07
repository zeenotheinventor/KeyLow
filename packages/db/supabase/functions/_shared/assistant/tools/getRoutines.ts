// The user's routines, for "what's in my push day?". A list holds no exercise, and one routine read by id
// holds its days with their exercises in order. Row level security shows a user their own routines only,
// so another user's id reads the same as one that does not exist.
import { z } from "zod";

import { describeRoutineCitation } from "../../core.ts";
import { getRoutine, listRoutines } from "../../repos.ts";
import { citedResult } from "./diaryView.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition, ToolRunOutput } from "../tool.ts";

const maxListedRoutines = 20;

const getRoutinesInput = z.strictObject({
  routine_id: z
    .guid()
    .nullable()
    .describe("The id of a routine from this tool's list, or null to list the routines."),
});

export const getRoutinesTool: ReadToolDefinition<z.infer<typeof getRoutinesInput>> = {
  name: "get_routines",
  description:
    "Reads the user's routines. With routine_id null it lists the routines that are not archived, at " +
    `most ${maxListedRoutines}, each with its id, name, whether it is the active one and how many days it has. ` +
    "With a routine_id it reads that routine: its days, each with its id, name and weekday (0 is Monday " +
    "to 6 is Sunday, null is any day), and each day's exercises in order, with the exercise_id, name, " +
    "sets, rep range and target reps in reserve (null is none set). The citation is the line the app " +
    "prints under your answer. Use these ids and never invent one. " +
    dataNotice,
  kind: "read",
  input: getRoutinesInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { routine_id }): Promise<ToolRunOutput> {
    if (routine_id === null) {
      const routines = await listRoutines(ctx.caller, { archived: false });
      return {
        data: {
          routines: routines.slice(0, maxListedRoutines).map(({ id, name, is_active, days }) => ({
            id,
            name,
            is_active,
            day_count: days.length,
          })),
          truncated: routines.length > maxListedRoutines,
        },
      };
    }
    const routine = await getRoutine(ctx.caller, routine_id);
    if (routine === null) {
      return { data: { error: "not_found" } };
    }
    return citedResult(
      {
        routine: {
          id: routine.id,
          name: routine.name,
          is_active: routine.is_active,
          is_archived: routine.is_archived,
          days: routine.days.map((day) => ({
            id: day.id,
            name: day.name,
            weekday: day.weekday,
            exercises: day.exercises.map((planned) => ({
              exercise_id: planned.exercise_id,
              name: planned.exercise.name,
              sets: planned.target_sets,
              rep_min: planned.rep_min,
              rep_max: planned.rep_max,
              target_rir: planned.target_rir,
            })),
          })),
        },
      },
      describeRoutineCitation(routine.name),
    );
  },
};
