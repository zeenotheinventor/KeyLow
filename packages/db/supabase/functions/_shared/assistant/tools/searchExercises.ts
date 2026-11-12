// The exercise library and the user's own exercises, searched by part of a name and never by muscle, for
// "find the bench press" and for an id a routine can use. Row level security shows a user the library and
// their own exercises only, and an archived exercise is never read.
import { z } from "zod";

import { EQUIPMENT, MUSCLE_IDS, MUSCLE_NAMES } from "../../core.ts";
import { searchExercises } from "../../repos.ts";
import { dataNotice, resultLimitSchema, searchTextSchema } from "./shared.ts";

import type { ReadToolDefinition, ToolContext } from "../tool.ts";

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

// The full muscle map of each of the user's own exercises, assisting muscles included, which the search keeps
// to the main muscles. An edit replaces the whole map, so the model needs every muscle to change one safely.
// The library's exercises cannot be edited, so they are left out and their rows stay the size they were.
async function readOwnMuscles(ctx: ToolContext, ids: readonly string[]) {
  const muscles = new Map<string, { muscle_id: string; role: string }[]>();
  if (ids.length === 0) {
    return muscles;
  }
  const { data, error } = await ctx.caller
    .from("exercise_muscles")
    .select("exercise_id,muscle_id,role")
    .in("exercise_id", [...ids]);
  if (error) {
    throw new Error(`Could not read the muscles ${error.code}`);
  }
  const listed = (muscleId: string) => MUSCLE_IDS.findIndex((id) => id === muscleId);
  for (const { exercise_id, muscle_id, role } of [...data].sort(
    (first, second) => listed(first.muscle_id) - listed(second.muscle_id),
  )) {
    muscles.set(exercise_id, [...(muscles.get(exercise_id) ?? []), { muscle_id, role }]);
  }
  return muscles;
}

export const searchExercisesTool: ReadToolDefinition<z.infer<typeof searchExercisesInput>> = {
  name: "search_exercises",
  description:
    "Finds exercises by part of their name, from the library and the user's own. It searches the name " +
    'only, so "chest" does not find a chest exercise: search names such as "bench". Each has its id, ' +
    "name, equipment, main muscles and is_own. For the user's own exercises it also has their muscles " +
    "with their roles, which a change to an exercise's muscles must start from. Use these ids, never " +
    "invent one. " +
    dataNotice,
  kind: "read",
  input: searchExercisesInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { query, equipment, limit }) {
    const exercises = await searchExercises(ctx.caller, query, { limit, equipment });
    const ownMuscles = await readOwnMuscles(
      ctx,
      exercises.filter(({ source }) => source === "user").map(({ id }) => id),
    );
    return {
      data: {
        exercises: exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          equipment: exercise.equipment,
          primary_muscles: exercise.primary_muscles.map((muscle) => MUSCLE_NAMES[muscle]),
          is_own: exercise.source === "user",
          ...(exercise.source === "user" ? { muscles: ownMuscles.get(exercise.id) ?? [] } : {}),
        })),
      },
    };
  },
};
