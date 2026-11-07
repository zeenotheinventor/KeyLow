// Archives one of the user's own exercises on their word: it leaves their exercise list, and the sets they
// logged with it stay in their history. No screen archives or restores a custom exercise, so this tool is
// the only way, and Undo is the only way back. The call always asks first, and the question and the buttons
// are the board's. Undo stores nothing: `restoreExercise` needs the exercise's id and no more, so it works
// from "What the assistant changed" after the conversation is deleted.
import { z } from "zod";

import {
  buildExerciseArchivedCard,
  confirmArchiveExerciseButtons,
  confirmArchiveExerciseQuestion,
} from "../../core.ts";
import { archiveExercise, restoreExercise } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";
import { globalExercise, readExerciseState } from "./exerciseWrite.ts";

import type { ConfirmationNeed, WriteToolDefinition } from "../tool.ts";

const archiveCustomExerciseInput = z.strictObject({
  id: z.guid().describe("The id of the user's own exercise, from search_exercises."),
});

type ArchiveCustomExerciseInput = z.infer<typeof archiveCustomExerciseInput>;

export const archiveCustomExerciseTool: WriteToolDefinition<ArchiveCustomExerciseInput> = {
  name: "archive_custom_exercise",
  description:
    "Archives one of the user's own exercises, with Undo. Take the id from search_exercises, never from " +
    "memory. The call first answers needs_confirmation with a confirmation_id: in the same response as the " +
    "call, before it, write the question in your own words, naming the exercise, that it leaves their " +
    "exercise list and that sets they logged with it stay in their history, and when they say yes call " +
    "again with the same id and that confirmation_id. When they say no, do not call again. An exercise " +
    "of the library cannot be archived, and the call answers global_exercise. An exercise that is not the " +
    "user's is reported as not found. There is no tool to bring an exercise back: point the user to Undo " +
    "in More, Assistant, What the assistant changed.",
  kind: "write",
  input: archiveCustomExerciseInput,
  // Like the other training tools, it takes nothing from the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "exercises",
  refusesDuringWorkout: true,
  // Asks only about an exercise there is to archive. A library exercise, one the user cannot see and one
  // that is archived already are answered by `run`, without a question or a button.
  async needsConfirmation({ id }, ctx): Promise<ConfirmationNeed> {
    const state = await readExerciseState(ctx, id);
    if (state === null || state.isLibrary || state.isArchived) {
      return false;
    }
    return {
      question: confirmArchiveExerciseQuestion(state.name),
      confirmLabel: confirmArchiveExerciseButtons().confirmLabel,
    };
  },
  async run(ctx, { id }) {
    const state = await readExerciseState(ctx, id);
    if (state === null) {
      return notFound;
    }
    if (state.isLibrary) {
      return globalExercise;
    }
    if (state.isArchived) {
      return { data: { id, archived: true, changed: false }, target: null };
    }
    await archiveExercise(ctx.caller, id);
    return {
      data: { id, archived: true, changed: true },
      structured: { card: buildExerciseArchivedCard({ name: state.name }) },
      target: { targetId: id },
    };
  },
  // Brings the exercise back, unless it is live already. Nothing else can have changed it, because it was
  // archived and no screen or tool edits an archived exercise.
  async inverse(ctx, action) {
    const { targetId } = action;
    const state = targetId === null ? null : await readExerciseState(ctx, targetId);
    if (targetId === null || state === null || state.isLibrary || !state.isArchived) {
      return "unavailable";
    }
    await restoreExercise(ctx.caller, targetId);
    return "undone";
  },
};
