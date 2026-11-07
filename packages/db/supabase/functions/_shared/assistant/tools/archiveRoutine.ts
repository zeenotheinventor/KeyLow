// Archives a routine on the user's word: it leaves the routine list, and the sessions logged with it stay in
// the history. The routine is kept, so Undo can bring it back. The call asks first when there is a routine to
// archive, and the question and the buttons are the board's. The active routine cannot be archived, and is
// refused in the app's own words before anything is asked.
import { z } from "zod";

import {
  ARCHIVE_ACTIVE_REFUSAL,
  buildRoutineArchivedCard,
  confirmArchiveRoutineButtons,
  confirmArchiveRoutineQuestion,
} from "../../core.ts";
import { listRoutines, setRoutineArchived } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";

import type {
  ToolContext,
  ConfirmationNeed,
  WriteRunOutput,
  WriteToolDefinition,
} from "../tool.ts";

const archiveRoutineInput = z.strictObject({
  routine_id: z.guid().describe("The id of the routine, from get_routines."),
});

type ArchiveRoutineInput = z.infer<typeof archiveRoutineInput>;

async function routineOf(ctx: ToolContext, routineId: string) {
  const routines = await listRoutines(ctx.caller, { archived: true });
  return routines.find(({ id }) => id === routineId);
}

export const archiveRoutineTool: WriteToolDefinition<ArchiveRoutineInput> = {
  name: "archive_routine",
  description:
    "Archives one of the user's routines, with Undo. Take the id from get_routines, never from memory. " +
    "The call first answers needs_confirmation with a confirmation_id: in the same response as the call, " +
    "before it, write the question in your own words, naming the routine, that it leaves their routine " +
    "list and that sessions they logged with it stay in their history, and when they say yes call again " +
    "with the same id and that confirmation_id. When they say no, do not call again. The active routine " +
    "cannot be archived: it is answered routine_is_active with the words to say, and nothing is asked. A " +
    "routine that is not the user's is reported as not found.",
  kind: "write",
  input: archiveRoutineInput,
  // The strict budget is spent (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "routines",
  refusesDuringWorkout: true,
  // Asks only about a routine that can be archived. One the user cannot see is answered `not_found`, one that
  // is archived already is answered as it is, and the active one is refused, all by `run`, without a question
  // or a button.
  async needsConfirmation({ routine_id }, ctx): Promise<ConfirmationNeed> {
    const routine = await routineOf(ctx, routine_id);
    if (routine === undefined || routine.is_archived || routine.is_active) {
      return false;
    }
    return {
      question: confirmArchiveRoutineQuestion(routine.name),
      confirmLabel: confirmArchiveRoutineButtons().confirmLabel,
    };
  },
  async run(ctx, { routine_id }): Promise<WriteRunOutput> {
    const routine = await routineOf(ctx, routine_id);
    if (routine === undefined) {
      return notFound;
    }
    if (routine.is_archived) {
      return { data: { routine_id, archived: true, changed: false }, target: null };
    }
    if (routine.is_active) {
      return { data: { error: "routine_is_active", say: ARCHIVE_ACTIVE_REFUSAL }, target: null };
    }
    await setRoutineArchived(ctx.caller, routine_id, true);
    return {
      data: { routine_id, archived: true, changed: true },
      // No `undo`: restoring needs nothing stored, only that the routine is still archived.
      structured: { card: buildRoutineArchivedCard({ name: routine.name }) },
      target: { targetId: routine_id },
    };
  },
  // Brings the routine back, unless the person has restored it since. That is the only change Undo looks for,
  // and the routine's own rows are untouched by an archive, so restoring loses nothing. It needs no stored
  // value, so it still works after the conversation is deleted. The tool refuses to restore a routine that is
  // not archived, so one made active in the app since is not touched either.
  async inverse(ctx, { targetId }) {
    const routine = targetId === null ? undefined : await routineOf(ctx, targetId);
    if (targetId === null || routine === undefined || !routine.is_archived) {
      return "unavailable";
    }
    await setRoutineArchived(ctx.caller, targetId, false);
    return "undone";
  },
};
