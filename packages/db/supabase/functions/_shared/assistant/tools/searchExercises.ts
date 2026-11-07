// The exercise library and the user's own exercises, searched by part of a name and never by muscle, for
// "find the bench press" and for an id a routine can use. Row level security shows a user the library and
// their own exercises only, and an archived exercise is never read.
import { z } from "zod";

import { EQUIPMENT, MUSCLE_NAMES } from "../../core.ts";
import { searchExercises } from "../../repos.ts";
import { dataNotice, resultLimitSchema, searchTextSchema } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const searchExercisesInput = z.strictObject({
  query: searchTextSchema,
  equipment: z
    .array(z.enum(EQUIPMENT))
    .nullable()
    .default(null)
    .describe(
      "Only exercises that use one of these kinds of equipment, or null for any. An empty list matches nothing.",
    ),
  limit: resultLimitSchema.default(5),
});

export const searchExercisesTool: ReadToolDefinition<z.infer<typeof searchExercisesInput>> = {
  name: "search_exercises",
  description:
    "Finds exercises by part of their name, from the library and the user's own. It searches the name " +
    'only, so "chest" does not find a chest exercise: search names such as "bench". Each has its id, ' +
    "name, equipment, main muscles and is_own. Use these ids, never invent one. " +
    dataNotice,
  kind: "read",
  input: searchExercisesInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { query, equipment, limit }) {
    const exercises = await searchExercises(ctx.caller, query, { limit, equipment });
    return {
      data: {
        exercises: exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          equipment: exercise.equipment,
          primary_muscles: exercise.primary_muscles.map((muscle) => MUSCLE_NAMES[muscle]),
          is_own: exercise.source === "user",
        })),
      },
    };
  },
};
