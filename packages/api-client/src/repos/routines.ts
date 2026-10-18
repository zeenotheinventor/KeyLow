import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import {
  ROUTINE_DETAIL_SELECT,
  ROUTINE_LIST_SELECT,
  routineDetailRowSchema,
  routineListRowSchema,
} from "./routineSchemas";
import { trainingRepoError } from "./training";

import type { RoutineDetail, RoutineListEntry } from "./routineSchemas";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

// A routine holds exercise names, a weekly plan and the names the user gave it: health data. A failure
// here names the action and the error code only, and the cause holds the code and nothing else, because
// the database's own message and details can quote the row that failed. User scoping is by row level
// security, as in the other training reads.

const ROW_ID = z.guid();

/** Throws a `RangeError` before any request when `id` is not a UUID. The one check every routine call makes of an id. */
export function assertRoutineId(id: string): void {
  if (!ROW_ID.safeParse(id).success) {
    throw new RangeError("A routine id must be a UUID");
  }
}

export type ListRoutinesOptions = {
  /** False lists the live routines, and true adds the archived ones to them. */
  archived: boolean;
};

/**
 * The signed in user's routines by name (then id, so equal names keep a fixed order), each with its
 * flags, when it was last activated and its days in position order with the sets planned for each day's
 * exercises. `archived` false leaves the archived routines out, and true includes them. Row level
 * security shows a user their own routines only.
 */
export async function listRoutines(
  client: SupabaseClient<Database>,
  { archived }: ListRoutinesOptions,
): Promise<RoutineListEntry[]> {
  const query = client.from("routines").select(ROUTINE_LIST_SELECT);

  const { data, error } = await (archived ? query : query.eq("is_archived", false))
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .order("position", { ascending: true, referencedTable: "routine_days" });

  if (error) {
    throw trainingRepoError("load your routines", error);
  }

  return data.map((row) => parseRow(routineListRowSchema, row, "read the routines", idOfRow));
}

/**
 * One routine of the signed in user with its days in position order and each day's exercises in
 * position order, or null when it does not exist or is not theirs (the two look the same). An archived
 * routine is returned. Throws a `RangeError` before any request when `id` is not a UUID.
 */
export async function getRoutine(
  client: SupabaseClient<Database>,
  id: string,
): Promise<RoutineDetail | null> {
  assertRoutineId(id);

  const { data, error } = await client
    .from("routines")
    .select(ROUTINE_DETAIL_SELECT)
    .eq("id", id)
    .order("position", { ascending: true, referencedTable: "routine_days" })
    .order("position", { ascending: true, referencedTable: "routine_days.routine_exercises" })
    .maybeSingle();

  if (error) {
    throw trainingRepoError("load your routine", error);
  }

  return data === null ? null : parseRow(routineDetailRowSchema, data, "read the routine", idOfRow);
}
