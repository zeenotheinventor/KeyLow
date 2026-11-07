// What the routine write tools share: the text that tells whether a routine changed since the assistant
// left it, and whether a workout was logged from one of its days.
import { draftOfStoredRoutine, routineFingerprint, routinePayload } from "../../core.ts";
import { getRoutine } from "../../repos.ts";

import type { Database } from "../../core/database.types.ts";
import type { RoutineDraft } from "../../core.ts";
import type { RoutineDetail } from "../../repos.ts";
import type { ToolContext } from "../tool.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

// The fingerprint of a routine as a read gives it. A tool stores this, and its Undo compares the same
// function of a later read, so both sides pass through one read shape and the day ids and number formats
// never decide the answer.
export const fingerprintOfStoredRoutine = (routine: RoutineDetail): string =>
  routineFingerprint(draftOfStoredRoutine(routine));

// Whether a live workout was started from one of these routine days, in one select under the caller's JWT.
// A deleted workout is ignored: this Undo only archives, and unlinks nothing, so a deleted workout loses nothing.
// An edit that removes days (KEY-902) counts deleted workouts too, because removing a day unlinks them.
// The database's message can quote a row, so a failure keeps its code only.
export async function hasWorkoutOnDays(
  ctx: ToolContext,
  dayIds: readonly string[],
): Promise<boolean> {
  if (dayIds.length === 0) {
    return false;
  }
  const { data, error } = await ctx.caller
    .from("workout_sessions")
    .select("id")
    .in("routine_day_id", [...dayIds])
    .is("deleted_at", null)
    .limit(1);
  if (error) {
    throw new Error(`Could not check the workouts of the routine (${error.code})`);
  }
  return data.length > 0;
}

type SaveRoutineArguments = Database["public"]["Functions"]["save_routine"]["Args"];

// The generated types name the routine's id a plain string, while the function takes null to make a new routine.
// Tying the object to the generated arguments keeps a renamed or retyped argument a build error.
type SaveRoutineCall = Omit<SaveRoutineArguments, "p_routine_id"> & { p_routine_id: string | null };

// Saves a checked draft with the `save_routine` call itself and answers the id of the routine. The repo helper
// reads the routine back after the call, and a throw from that read looks the same as a throw from the write.
// A tool must not throw once its write has landed, so this has no read-back: an error here means nothing was
// written, and the id is all the caller has until it reads the routine itself. A null `routineId` makes a new
// routine. The error carries the code only, because the message can quote a name.
export async function saveRoutineDraft(
  ctx: ToolContext,
  routineId: string | null,
  draft: RoutineDraft,
): Promise<string> {
  const { p_routine, p_days } = routinePayload(draft);
  const call: SaveRoutineCall = {
    p_routine_id: routineId,
    p_routine,
    // Json arrays are mutable, and the payload's are read-only, so the days and their exercises are copied.
    p_days: p_days.map((day) => ({ ...day, exercises: [...day.exercises] })),
  };
  const name: keyof Database["public"]["Functions"] = "save_routine";
  const untyped: SupabaseClient = ctx.caller;
  const { data, error } = await untyped.rpc(name, call);
  if (error) {
    throw new Error(`Could not save the routine (${error.code || "no code"})`);
  }
  if (typeof data !== "string") {
    throw new Error("Could not save the routine (no id)");
  }
  return data;
}

// The routine as stored, or null when it cannot be read. For a caller whose write has landed, which must not
// throw: the failure is reported and the caller goes on with what it holds. Nothing in the report quotes the routine.
export async function readBackQuietly(
  ctx: ToolContext,
  routineId: string,
): Promise<RoutineDetail | null> {
  try {
    return await getRoutine(ctx.caller, routineId);
  } catch (caught) {
    try {
      ctx.reportError("assistant tool routine read-back", "internal_error", caught);
    } catch {
      // Reporting is a side channel.
    }
    return null;
  }
}
