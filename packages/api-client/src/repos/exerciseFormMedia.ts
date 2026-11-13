import { exerciseFormMediaSetOf } from "@keylow/core/training";

import { repoError } from "./repoError";

import type { Database } from "../database.types";
import type { ExerciseFormMediaSet } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What an exercise has for its form: the curated video, its two photos, both or neither. It reads the
 * `exercise_form_media` database function, which answers no row for an exercise the caller cannot see, and
 * that is neither, like any other exercise with nothing to show. A failure names the action and the code
 * only, never the database's message or the row.
 */
export async function getExerciseFormMedia(
  client: SupabaseClient<Database>,
  exerciseId: string,
): Promise<ExerciseFormMediaSet> {
  const { data, error } = await client.rpc("exercise_form_media", { p_exercise_id: exerciseId });

  if (error) {
    throw repoError("load the form media of an exercise", error);
  }

  return exerciseFormMediaSetOf(data[0] ?? null);
}
