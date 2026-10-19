import { customExercisePayload, validateCustomExerciseDraft } from "@keylow/core/training";

import { ExerciseRuleError } from "../errors";
import { assertExerciseId, getExercise } from "./exercises";
import { untypedFunctions } from "./nullableArguments";
import { trainingRepoError } from "./training";

import type { ExerciseDetail } from "./exercises";
import type { WithNullable } from "./nullableArguments";
import type { Database } from "../database.types";
import type { CustomExerciseDraft } from "@keylow/core/training";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// The exercise writes. An exercise's name and muscles are health data, so a failure here names the action
// and the error code only, as the reads do, and a check that fails before a request names the rules and
// the fields and never a name or a muscle from the draft. Every write needs a connection: nothing is queued.

/** no_data_found: `save_exercise` raises it for an exercise that does not exist or is not the caller's. */
const NO_DATA_FOUND = "P0002";

/** PostgREST's code for a request for one row that matched none. */
const NO_ROW_MATCHED = "PGRST116";

type Functions = Database["public"]["Functions"];

export type ExerciseSave = {
  /** The exercise to edit. Left out to create one. */
  id?: string;
  draft: CustomExerciseDraft;
};

/**
 * Whether a write that matched no exercise was aimed at one of the library. The database answers the same
 * for a library exercise, another user's and one that does not exist, so that no one can tell whether a
 * private exercise exists. A library exercise is visible to everyone, so reading it tells nothing, and the
 * screen can be told the real rule. A read that fails leaves the original failure to be thrown.
 */
async function isLibraryExercise(client: SupabaseClient<Database>, id: string): Promise<boolean> {
  try {
    const exercise = await getExercise(client, id);
    return exercise !== null && exercise.source !== "user";
  } catch {
    return false;
  }
}

async function refusal(
  client: SupabaseClient<Database>,
  id: string | undefined,
  action: string,
  error: PostgrestError,
  noMatchCode: string,
): Promise<Error> {
  if (id !== undefined && error.code === noMatchCode && (await isLibraryExercise(client, id))) {
    return new ExerciseRuleError(action, "global_exercise");
  }
  return trainingRepoError(action, error);
}

/**
 * Saves a custom exercise with one `save_exercise` call, which writes the exercise and replaces its muscle
 * map or does neither, and resolves to the exercise as stored. The draft is checked by core's
 * `validateCustomExerciseDraft` first: a draft the database would refuse, an exercise with no primary
 * muscle included, throws a `RangeError` before any request, naming each field and rule. The mechanic is
 * derived from the muscles and each muscle carries the weight of its role. Left without an `id` it creates
 * an exercise of the user's own, with an id the database chooses. With an `id` it edits one: a library
 * exercise is refused with an `ExerciseRuleError` with the rule `global_exercise`, and an exercise that
 * does not exist or is not the caller's fails with the code P0002. Sets already logged keep the muscle
 * map they were logged with. Two devices saving at once is last save wins.
 *
 * Saving an archived exercise commits (`save_exercise` ignores `deleted_at`) and then throws "Could not
 * load the exercise after saving it", because the read-back shows live exercises only. The screens do not
 * reach this: an archived exercise is not offered for editing.
 */
export async function saveExercise(
  client: SupabaseClient<Database>,
  { id, draft }: ExerciseSave,
): Promise<ExerciseDetail> {
  const checked = validateCustomExerciseDraft(draft);
  if (!checked.ok) {
    const problems = checked.problems.map(({ field, rule }) => `${field} (${rule})`);
    throw new RangeError(`The exercise is not valid at ${problems.join(", ")}`);
  }
  if (id !== undefined) {
    assertExerciseId(id);
  }

  const { p_exercise, p_muscles } = customExercisePayload(checked.value);
  const response = await untypedFunctions(client).rpc("save_exercise", {
    p_exercise_id: id ?? null,
    p_exercise,
    // Json arrays are mutable, and the payload's are read-only, so the muscles are copied.
    p_muscles: [...p_muscles],
  } satisfies WithNullable<Functions["save_exercise"]["Args"], "p_exercise_id">);

  if (response.error) {
    throw await refusal(client, id, "save the exercise", response.error, NO_DATA_FOUND);
  }

  const savedId: unknown = response.data;
  const stored = typeof savedId === "string" ? await getExercise(client, savedId) : null;
  if (stored === null) {
    throw new Error("Could not load the exercise after saving it");
  }
  return stored;
}

/**
 * Archives a custom exercise: a soft delete that sets `deleted_at`, so search and `getExercise` no longer
 * show it while the sets already logged and the routines that name it keep referencing it. Archiving one
 * that is already archived rewrites `deleted_at` with the new time and nothing else. An exercise of the
 * library is refused with an `ExerciseRuleError` with the rule `global_exercise`, and one that is not the
 * caller's or does not exist fails with the code PGRST116.
 */
export async function archiveExercise(client: SupabaseClient<Database>, id: string): Promise<void> {
  assertExerciseId(id);

  const { error } = await client
    .from("exercises")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    throw await refusal(client, id, "archive the exercise", error, NO_ROW_MATCHED);
  }
}
