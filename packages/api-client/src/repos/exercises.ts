import {
  exerciseMusclesSchema,
  exerciseMuscleEntrySchema,
  exerciseRowSchema,
} from "@keylow/core/schemas";
import { MUSCLE_IDS } from "@keylow/core/training";
import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import { escapeLikePattern } from "./escapeLikePattern";
import { MIN_SEARCH_LENGTH } from "./foods";
import { trainingRepoError } from "./training";

import type { Database } from "../database.types";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { MuscleId, MuscleRole } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

// An exercise name and its muscle map are health data. A failure here names the action and the error
// code only, and the cause holds the code and nothing else, because the database's own message and
// details can quote the row that failed. A row that does not parse is reported by its id and the paths of
// the fields that failed.

const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 50;

const ROW_ID = z.guid();

const exerciseShape = exerciseRowSchema.shape;

const EXERCISE_COLUMNS =
  "id,name,equipment,mechanic,source,exercise_muscles(muscle_id,role,weight)";

const exerciseColumnsShape = {
  id: exerciseShape.id,
  name: exerciseShape.name,
  equipment: exerciseShape.equipment,
  mechanic: exerciseShape.mechanic,
  source: exerciseShape.source,
};

const listPosition = (muscle: ExerciseMuscleEntry): number => MUSCLE_IDS.indexOf(muscle.muscle_id);

const inListOrder = (first: ExerciseMuscleEntry, second: ExerciseMuscleEntry): number =>
  listPosition(first) - listPosition(second);

const musclesWithRole = (muscles: readonly ExerciseMuscleEntry[], role: MuscleRole): MuscleId[] =>
  muscles
    .filter((muscle) => muscle.role === role)
    .sort((first, second) => second.weight - first.weight || inListOrder(first, second))
    .map(({ muscle_id }) => muscle_id);

const exerciseHitSchema = z
  .object({ ...exerciseColumnsShape, exercise_muscles: z.array(exerciseMuscleEntrySchema) })
  .transform(({ exercise_muscles, ...exercise }) => ({
    ...exercise,
    primary_muscles: musclesWithRole(exercise_muscles, "primary"),
    secondary_muscles: musclesWithRole(exercise_muscles, "secondary"),
  }));

const exerciseDetailSchema = z
  .object({ ...exerciseColumnsShape, exercise_muscles: exerciseMusclesSchema })
  .transform(({ exercise_muscles, ...exercise }) => ({
    ...exercise,
    muscles: [...exercise_muscles].sort(inListOrder),
  }));

/**
 * One exercise of a search, for its row. `source` is `user` for the signed in user's own exercise and
 * `free_exercise_db` for the library. The muscle ids are for the row's chips: the primary muscles first
 * and the secondary after, the stronger first within each, and the assisting ones are left out.
 */
export type ExerciseSearchHit = z.output<typeof exerciseHitSchema>;

/** One live exercise with its full muscle map, in the order of the muscle list. */
export type ExerciseDetail = z.output<typeof exerciseDetailSchema>;

export type ExerciseSearchOptions = {
  /** How many exercises to ask for, 1 to 50. Defaults to 25. */
  limit?: number;
};

export function assertExerciseId(id: string): void {
  if (!ROW_ID.safeParse(id).success) {
    throw new RangeError("An exercise id must be a UUID");
  }
}

/**
 * The live exercises whose name contains `query`, ignoring case: the signed in user's own first, then
 * the library by name. This is an `ilike` through PostgREST (ADR 0005, Amendment 1, `exercises`), with
 * `%` and `_` in the query escaped so they match literally (a `*` is the exception, see
 * `escapeLikePattern`). Row level security shows a user the library and their own exercises only, and an
 * archived exercise is left out. A query shorter than `MIN_SEARCH_LENGTH` once trimmed is answered with
 * no exercises and no request. `limit` is kept between 1 and 50.
 */
export async function searchExercises(
  client: SupabaseClient<Database>,
  query: string,
  { limit = DEFAULT_SEARCH_LIMIT }: ExerciseSearchOptions = {},
): Promise<ExerciseSearchHit[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const { data, error } = await client
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .ilike("name", `%${escapeLikePattern(trimmedQuery)}%`)
    .is("deleted_at", null)
    .in("exercise_muscles.role", ["primary", "secondary"])
    .order("owner_id", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(limit))));

  if (error) {
    throw trainingRepoError("search the exercises", error);
  }

  return data.map((row) => parseRow(exerciseHitSchema, row, "search the exercises", idOfRow));
}

/**
 * One live exercise with its full muscle map. Null when it is not visible to the user: it does not
 * exist, is archived, or is another user's private one, which all look the same.
 */
export async function getExercise(
  client: SupabaseClient<Database>,
  id: string,
): Promise<ExerciseDetail | null> {
  assertExerciseId(id);

  const { data, error } = await client
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw trainingRepoError("load the exercise", error);
  }

  return data === null ? null : parseRow(exerciseDetailSchema, data, "load the exercise", idOfRow);
}
