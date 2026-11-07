// What the routine write tools share: the text that tells whether a routine changed since the assistant
// left it, and whether a workout was logged from one of its days.
import { draftOfStoredRoutine, routineFingerprint } from "../../core.ts";

import type { RoutineDetail } from "../../repos.ts";
import type { ToolContext } from "../tool.ts";

// The fingerprint of a routine as a read gives it. A tool stores this, and its Undo compares the same
// function of a later read, so both sides pass through one read shape and the day ids and number formats
// never decide the answer.
export const fingerprintOfStoredRoutine = (routine: RoutineDetail): string =>
  routineFingerprint(draftOfStoredRoutine(routine));

// Whether a live workout was started from one of these routine days, in one select under the caller's JWT.
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
