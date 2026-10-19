import { routinePayload, validateRoutineDraft } from "@keylow/core/training";

import { RoutineRuleError } from "../errors";
import { idOfRow, parseRow } from "./diaryRows";
import { untypedFunctions } from "./nullableArguments";
import { assertRoutineId, getRoutine } from "./routines";
import { ROUTINE_RECORD_COLUMNS, routineRecordSchema } from "./routineSchemas";
import { trainingRepoError } from "./training";

import type { WithNullable } from "./nullableArguments";
import type { RoutineDetail, RoutineRecord } from "./routineSchemas";
import type { Database } from "../database.types";
import type { RoutineDraft } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

// The routine writes. A routine is health data, so a failure here names the action and the error code
// only, as the reads do, and a check that fails before a request names the rules and the places in the
// draft and never a name or a number from it. Every write needs a connection: nothing is queued.

/** The name of the table check that keeps an archived routine from being active (ADR 0005, "Routines"). */
const ACTIVE_NOT_ARCHIVED_CHECK = "routines_active_not_archived";

/** A check_violation, the code Postgres raises when a row breaks a table check. */
const CHECK_VIOLATION = "23514";

export type RoutineSave = {
  /** The routine to edit, or null to create one. */
  id: string | null;
  draft: RoutineDraft;
};

type Functions = Database["public"]["Functions"];

/**
 * Saves a routine with one `save_routine` call, which writes the routine, its days and their exercises
 * or none of them, and resolves to the routine as stored. The draft is checked by core's
 * `validateRoutineDraft` first: a draft the database would refuse throws a `RangeError` before any
 * request, naming each rule and where it failed. A day sent with its id is updated in place and keeps it,
 * a day sent without one is added, and a day left out is deleted, which unlinks the sessions logged from
 * it. Whether the routine is active or archived is not touched. A routine that does not exist, or is not
 * the caller's (the two look the same), fails with the code P0002. Two devices saving at once is last
 * save wins.
 */
export async function saveRoutine(
  client: SupabaseClient<Database>,
  { id, draft }: RoutineSave,
): Promise<RoutineDetail> {
  const checked = validateRoutineDraft(draft);
  if (!checked.ok) {
    const problems = checked.problems.map(({ path, rule }) => `${path.join(".")} (${rule})`);
    throw new RangeError(`The routine is not valid at ${problems.join(", ")}`);
  }
  if (id !== null) {
    assertRoutineId(id);
  }

  const { p_routine, p_days } = routinePayload(checked.value);
  const response = await untypedFunctions(client).rpc("save_routine", {
    p_routine_id: id,
    p_routine,
    // Json arrays are mutable, and the payload's are read-only, so the days and their exercises are copied.
    p_days: p_days.map((day) => ({ ...day, exercises: [...day.exercises] })),
  } satisfies WithNullable<Functions["save_routine"]["Args"], "p_routine_id">);

  if (response.error) {
    throw trainingRepoError("save the routine", response.error);
  }

  const savedId: unknown = response.data;
  const stored = typeof savedId === "string" ? await getRoutine(client, savedId) : null;
  if (stored === null) {
    throw new Error("Could not load the routine after saving it");
  }
  return stored;
}

/**
 * Makes the routine `id` the active one and clears whichever was active, in one `set_active_routine`
 * call, and resolves to the routine as stored, with its activation moment. `activated_at` is stamped by
 * the database, so a routine plans from the day it is made active. With null it clears the active
 * routine and resolves to null. An archived routine fails with the code 22023, and one that does not
 * exist or is not the caller's with P0002.
 */
export async function setActiveRoutine(
  client: SupabaseClient<Database>,
  id: string | null,
): Promise<RoutineDetail | null> {
  if (id !== null) {
    assertRoutineId(id);
  }

  const { error } = await untypedFunctions(client).rpc("set_active_routine", {
    p_routine_id: id,
  } satisfies WithNullable<Functions["set_active_routine"]["Args"], "p_routine_id">);

  if (error) {
    throw trainingRepoError("make the routine active", error);
  }

  if (id === null) {
    return null;
  }
  const stored = await getRoutine(client, id);
  if (stored === null) {
    throw new Error("Could not load the routine after making it active");
  }
  return stored;
}

/**
 * Archives a routine, or brings it back with `archived` false, and resolves to it as stored. This is a
 * plain update of one column, and the days and exercises are untouched. The Undo of an archive is this
 * call again with the same id and `archived` false. The active routine cannot be archived: the table
 * refuses it, and this throws a `RoutineRuleError` with the rule `active_routine`, so the screen makes
 * another routine active, or none, first. A routine that is not the caller's matches no row, and that
 * fails with the code PGRST116.
 */
export async function setRoutineArchived(
  client: SupabaseClient<Database>,
  id: string,
  archived: boolean,
): Promise<RoutineRecord> {
  assertRoutineId(id);
  const action = archived ? "archive the routine" : "restore the routine";

  const { data, error } = await client
    .from("routines")
    .update({ is_archived: archived })
    .eq("id", id)
    .select(ROUTINE_RECORD_COLUMNS)
    .single();

  if (error) {
    if (error.code === CHECK_VIOLATION && error.message.includes(ACTIVE_NOT_ARCHIVED_CHECK)) {
      throw new RoutineRuleError(action, "active_routine");
    }
    throw trainingRepoError(action, error);
  }

  return parseRow(routineRecordSchema, data, action, idOfRow);
}
