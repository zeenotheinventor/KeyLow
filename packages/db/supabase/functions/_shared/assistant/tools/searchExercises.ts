// The exercise library and the user's own exercises, for "find me a chest exercise" and for an id a
// routine can use. Row level security shows a user the library and their own exercises only, and an
// archived exercise is never read.
import { z } from "zod";

import { EQUIPMENT, MUSCLE_NAMES } from "../../core.ts";
import { searchExercises } from "../../repos.ts";
import { dataNotice, resultLimitSchema, searchTextSchema } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const searchExercisesInput = z.strictObject({
  query: searchTextSchema,
  equipment: z
    .array(z.enum(EQUIPMENT))
    .min(1)
    .nullable()
    .describe("Only exercises that use one of these kinds of equipment, or null for any."),
  limit: resultLimitSchema.default(5),
});

export const searchExercisesTool: ReadToolDefinition<z.infer<typeof searchExercisesInput>> = {
  name: "search_exercises",
  description:
    "Searches the exercises the user can use, the library and their own, by part of a name. Each has " +
    "its id, name, equipment, the muscles it mainly works and whether it is the user's own. Use it to " +
    "find an exercise, or to find one the user's equipment allows by passing equipment. An archived " +
    "exercise is never listed. Use these ids and never invent one. " +
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
