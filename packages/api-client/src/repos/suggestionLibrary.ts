import { exerciseMuscleEntrySchema, exerciseRowSchema } from "@keylow/core/schemas";
import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import { trainingRepoError } from "./training";

import type { Database } from "../database.types";
import type { SuggestExercise } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

// An exercise name and its muscle map are health data. A failure here names the action and the error
// code only, and the cause holds the code and nothing else, because the database's own message and
// details can quote the row that failed. A row that does not parse is reported by its id and the paths of
// the fields that failed.

/** The columns `suggestSession` reads of an exercise, with the muscle map embedded. */
const LIBRARY_COLUMNS = "id,name,equipment,mechanic,exercise_muscles(muscle_id,role,weight)";

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;

const exerciseShape = exerciseRowSchema.shape;

const libraryRowSchema = z
  .object({
    id: exerciseShape.id,
    name: exerciseShape.name,
    equipment: exerciseShape.equipment,
    mechanic: exerciseShape.mechanic,
    exercise_muscles: z.array(exerciseMuscleEntrySchema),
  })
  .transform(({ exercise_muscles, ...exercise }): SuggestExercise => ({
    ...exercise,
    muscles: exercise_muscles,
  }));

export type SuggestionLibraryOptions = {
  /** The equipment the user has: only exercises of these are read. */
  equipment: readonly SuggestExercise["equipment"][];
};

/**
 * The live exercises `suggestSession` chooses from: the library and the signed in user's own whose
 * equipment is in `equipment`, each with its full muscle map, in the order of their ids. Row level
 * security shows a user the library and their own exercises only, so another user's custom exercise
 * is never here, and an archived exercise is left out. The API returns at most 1,000 rows to a request,
 * so the library is read a page at a time until a page comes back short, and joined. No equipment is
 * answered with no exercises and no request.
 */
export async function listSuggestionLibrary(
  client: SupabaseClient<Database>,
  { equipment }: SuggestionLibraryOptions,
): Promise<SuggestExercise[]> {
  if (equipment.length === 0) {
    return [];
  }

  const library: SuggestExercise[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("exercises")
      .select(LIBRARY_COLUMNS)
      .is("deleted_at", null)
      .in("equipment", [...equipment])
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw trainingRepoError("load the exercise library", error);
    }

    library.push(
      ...data.map((row) => parseRow(libraryRowSchema, row, "read the exercise library", idOfRow)),
    );

    if (data.length < PAGE_SIZE) {
      return library;
    }
  }
}
