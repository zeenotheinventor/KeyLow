// Deletes one finished workout and its sets on the user's word: it leaves their history and their weekly numbers.
// Always asks first, because the person cannot do this again from the app once it is gone. The question and the
// buttons are the board's, built from the tool's own read. Undo brings the workout back by the stamp the delete
// left on its rows, and needs no value stored beside the card, so it still works after the conversation is deleted.
import { z } from "zod";

import {
  buildWorkoutDeletedCard,
  confirmDeleteWorkoutButtons,
  confirmDeleteWorkoutQuestion,
  planProgress,
} from "../../core.ts";
import { deleteSession, getSession, restoreSession } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";

import type { SessionSet } from "../../repos.ts";
import type {
  ConfirmationNeed,
  InverseOutcome,
  ToolContext,
  WriteRunOutput,
  WriteToolDefinition,
} from "../tool.ts";

const deleteWorkoutInput = z.strictObject({
  session_id: z.guid().describe("The id of the workout, from get_workouts."),
});

type DeleteWorkoutInput = z.infer<typeof deleteWorkoutInput>;

// The sets the app's own delete question counts: the working sets, or the warm-ups when only those are logged.
// A set the person removed is never counted, and neither is a set the read leaves out.
function setCountOf(sets: readonly SessionSet[]): number {
  const { logged, warmups } = planProgress(null, sets);
  return logged === 0 ? warmups : logged;
}

// What the session's `deleted_at` is, as the database stored it, or null when the person cannot see the session.
// It is the same text the delete stamped on the session's sets, so `restoreSession` finds them by it. It is
// kept untouched: a `Date` would drop its microseconds. A failure names the code only, because the message can
// quote the row.
async function deletedAtOf(
  ctx: ToolContext,
  sessionId: string,
): Promise<{ deletedAt: string | null } | null> {
  const { data, error } = await ctx.caller
    .from("workout_sessions")
    .select("deleted_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not read the session (${error.code || "no code"})`);
  }
  return data === null ? null : { deletedAt: data.deleted_at };
}

// The stamp the delete left, or null when it cannot be read. It must not throw, because the delete has landed:
// a throw would answer `tool_failed` and the model would retry a delete that is done. With no stamp the action
// has nothing to restore by, and Undo answers unavailable.
async function stampAfterDelete(ctx: ToolContext, sessionId: string): Promise<string | null> {
  try {
    return (await deletedAtOf(ctx, sessionId))?.deletedAt ?? null;
  } catch (caught) {
    try {
      ctx.reportError("assistant tool delete_workout", "internal_error", caught);
    } catch {
      // Reporting is a side channel.
    }
    return null;
  }
}

const unavailable: InverseOutcome = "unavailable";

export const deleteWorkoutTool: WriteToolDefinition<DeleteWorkoutInput> = {
  name: "delete_workout",
  description:
    "Deletes one finished workout of the user's, with its sets, with Undo. Take the id from get_workouts, never " +
    "from memory. The call first answers needs_confirmation with a confirmation_id: in the same response as the " +
    "call, before it, write the question in your own words, naming the workout's day and date and that it leaves " +
    "their history and their weekly numbers, and when they say yes call again with the same id and that " +
    "confirmation_id. When they say no, do not call again. A workout in progress cannot be deleted, and then the " +
    "answer is workout_in_progress. A workout that is not the user's or is already deleted is reported as not found.",
  kind: "write",
  input: deleteWorkoutInput,
  // The strict budget is spent (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "workout_sessions",
  refusesDuringWorkout: true,
  // Asks only about a workout that can be deleted. One the user cannot see, or one still in progress, is answered by
  // `run` with no question and no button.
  async needsConfirmation({ session_id }, ctx): Promise<ConfirmationNeed> {
    const session = await getSession(ctx.caller, session_id);
    if (session === null || session.ended_at === null) {
      return false;
    }
    return {
      question: confirmDeleteWorkoutQuestion({
        dayName: session.routine_day_name,
        localDate: session.local_date,
        setCount: setCountOf(session.sets),
      }),
      confirmLabel: confirmDeleteWorkoutButtons().confirmLabel,
    };
  },
  async run(ctx, { session_id }): Promise<WriteRunOutput> {
    // A deleted session, one that is not the person's and one that does not exist all read as null.
    const session = await getSession(ctx.caller, session_id);
    if (session === null) {
      return notFound;
    }
    // The workout in progress is never the target, whatever the executor's guard saw: one may have begun since.
    if (session.ended_at === null) {
      return { data: { error: "workout_in_progress" }, target: null };
    }

    // A refused delete throws before anything landed, and the executor releases the slot.
    await deleteSession(ctx.caller, session_id);
    // The write is done. Nothing below may throw.
    const deletedAt = await stampAfterDelete(ctx, session_id);
    return {
      data: { session_id, deleted: true },
      // No `undo`: restoring needs nothing stored, only the stamp the action keeps as its target's time.
      structured: {
        card: buildWorkoutDeletedCard({
          dayName: session.routine_day_name,
          localDate: session.local_date,
          setCount: setCountOf(session.sets),
        }),
      },
      target: {
        targetId: session_id,
        ...(deletedAt === null ? {} : { targetUpdatedAt: deletedAt }),
      },
    };
  },
  // Brings the workout back with the stamp its delete left, so the sets the person removed earlier stay removed.
  // Unavailable when the session is not the person's, was deleted again, or is already back in the history. A
  // restore that failed between its two writes leaves the session live and its sets stamped: that is the one
  // live session Undo still finishes, and it is told from a workout that is whole by the sets the restore brings.
  async inverse(ctx, { targetId, targetUpdatedAt }) {
    if (targetId === null || targetUpdatedAt === null) {
      return unavailable;
    }
    const stored = await deletedAtOf(ctx, targetId);
    if (stored === null || (stored.deletedAt !== null && stored.deletedAt !== targetUpdatedAt)) {
      return unavailable;
    }
    const live = stored.deletedAt === null ? await getSession(ctx.caller, targetId) : null;
    const restored = await restoreSession(ctx.caller, targetId, { deletedAt: targetUpdatedAt });
    return live !== null && live.sets.length === restored.sets.length ? unavailable : "undone";
  },
};
