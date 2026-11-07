// Adds one of the user's own exercises, or changes one, as the New exercise form does, with a card and
// Undo. No screen edits or archives a custom exercise, so the card has no link and this tool is the only way
// to do either. An edit never touches the sets already logged, which hold a snapshot of the exercise as it
// was. The previous value goes beside the card for Undo and never reaches the model.
import { z } from "zod";

import {
  buildExerciseCreatedCard,
  buildExerciseUpdatedCard,
  validateCustomExerciseDraft,
} from "../../core.ts";
import { archiveExercise, saveExercise } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";
import {
  equipmentSchema,
  exerciseFingerprint,
  globalExercise,
  isExerciseInUse,
  muscleIdSchema,
  muscleRoleSchema,
  readExerciseState,
} from "./exerciseWrite.ts";

import type { CustomExerciseDraft } from "../../core.ts";
import type { ExerciseState } from "./exerciseWrite.ts";
import type { InverseOutcome, ToolContext, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const muscleInput = z.strictObject({
  muscle_id: muscleIdSchema.describe("One of Ki-Lo's muscle ids."),
  role: muscleRoleSchema.describe(
    "primary counts a set in full, secondary counts half, stabiliser counts a fifth and the user calls it assisting.",
  ),
});

const saveCustomExerciseInput = z.strictObject({
  id: z
    .guid()
    .nullable()
    .default(null)
    .describe(
      "The id of the user's own exercise to change, from search_exercises, or null to add a new one.",
    ),
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .default(null)
    .describe("The exercise's name. Needed to add one. When changing, null keeps the name."),
  equipment: equipmentSchema
    .nullable()
    .default(null)
    .describe("The equipment it uses. Needed to add one. When changing, null keeps it."),
  muscles: z
    .array(muscleInput)
    .min(1)
    .max(22)
    .nullable()
    .default(null)
    .describe(
      "Every muscle the exercise works, each with its role, and at least one primary. Needed to add one. When changing, a list replaces the whole map, so null keeps it.",
    ),
});

type SaveCustomExerciseInput = z.infer<typeof saveCustomExerciseInput>;

// The fields a refused draft names, and the rules that broke, in the order of the form. A rule is a stable
// code and never carries a value.
function refusedDraft(draft: CustomExerciseDraft): WriteRunOutput | null {
  const checked = validateCustomExerciseDraft(draft);
  if (checked.ok) {
    return null;
  }
  return {
    data: {
      error: "invalid_input",
      fields: [...new Set(checked.problems.map(({ field }) => field))],
      rules: checked.problems.map(({ rule }) => rule),
    },
    target: null,
  };
}

const draftOf = (state: ExerciseState) => ({
  name: state.name,
  equipment: state.equipment,
  muscles: state.muscles.map(({ muscle_id, role }) => ({ muscle_id, role })),
});

// The draft an edit would save: what the call gave, and what the exercise holds for each null.
function editedDraft(input: SaveCustomExerciseInput, state: ExerciseState): CustomExerciseDraft {
  const kept = draftOf(state);
  return {
    name: input.name ?? kept.name,
    equipment: input.equipment ?? kept.equipment,
    muscles: input.muscles ?? kept.muscles,
  };
}

const sameDraft = (first: CustomExerciseDraft, second: CustomExerciseDraft): boolean =>
  first.name.trim() === second.name.trim() &&
  first.equipment === second.equipment &&
  first.muscles.length === second.muscles.length &&
  first.muscles.every((muscle) =>
    second.muscles.some(
      ({ muscle_id, role }) => muscle_id === muscle.muscle_id && role === muscle.role,
    ),
  );

const previousDraftSchema = z.object({
  name: z.string(),
  equipment: equipmentSchema,
  muscles: z.array(z.object({ muscle_id: muscleIdSchema, role: muscleRoleSchema })),
});

export const saveCustomExerciseTool: WriteToolDefinition<SaveCustomExerciseInput> = {
  name: "save_custom_exercise",
  description:
    "Adds one of the user's own exercises, or changes one of them, with Undo. To add one pass id as null " +
    "with the name, the equipment and every muscle with its role, at least one primary. To change one pass " +
    "its id from search_exercises and only the fields that change, null for the rest. Muscles replaces the " +
    "whole map, and search_exercises shows only the main muscles, so pass muscles only when the user asked " +
    "to change them, with every muscle the exercise should work. An exercise of the library cannot be " +
    "changed, and the call answers global_exercise: tell the user, and offer to add their own. Sets the " +
    "user already logged keep what they were. An archived exercise is answered as not found, and there is " +
    "no tool to bring one back: point the user to Undo in More, Assistant, What the assistant changed. A " +
    "new exercise is not in any routine, so say it can go in a day when the user says which, or in the " +
    "routine editor.",
  kind: "write",
  input: saveCustomExerciseInput,
  // Four nullable fields, and an array, would take from the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "exercises",
  refusesDuringWorkout: true,
  async run(ctx, input): Promise<WriteRunOutput> {
    if (input.id === null) {
      return await add(ctx, input);
    }
    const state = await readExerciseState(ctx, input.id);
    if (state === null || state.isArchived) {
      return notFound;
    }
    if (state.isLibrary) {
      return globalExercise;
    }
    const draft = editedDraft(input, state);
    const refused = refusedDraft(draft);
    if (refused !== null) {
      return refused;
    }
    if (sameDraft(draft, draftOf(state))) {
      return { data: { id: input.id, changed: false }, target: null };
    }
    const saved = await saveExercise(ctx.caller, { id: input.id, draft });
    // The write has landed. Nothing below may throw, or the model would save the change a second time.
    return {
      data: { id: saved.id, name: saved.name, changed: true },
      structured: {
        card: buildExerciseUpdatedCard({ before: state, after: saved }),
        undo: {
          previous: draftOf(state),
          fingerprint: exerciseFingerprint({ ...saved, isArchived: false }),
        },
      },
      target: { targetId: saved.id },
    };
  },
  // Puts back what an edit changed, or archives what an addition made. Both refuse once the exercise
  // changed since, which only the assistant can do. An addition is also refused once anything uses it,
  // because archiving would leave a routine or a logged set on an exercise nothing can bring back.
  async inverse(ctx, action): Promise<InverseOutcome> {
    const { targetId } = action;
    const stored = await ctx.previousValueOf(action);
    const state = targetId === null ? null : await readExerciseState(ctx, targetId);
    if (stored === null || targetId === null || state === null || state.isLibrary) {
      return "unavailable";
    }
    if (exerciseFingerprint(state) !== stored.fingerprint) {
      return { status: "unavailable", reason: "changed" };
    }
    if (stored.previous === null) {
      if (await isExerciseInUse(ctx, targetId)) {
        return { status: "unavailable", reason: "used" };
      }
      await archiveExercise(ctx.caller, targetId);
      return "undone";
    }
    const previous = previousDraftSchema.safeParse(stored.previous);
    if (!previous.success) {
      return "unavailable";
    }
    await saveExercise(ctx.caller, { id: targetId, draft: previous.data });
    return "undone";
  },
};

async function add(
  ctx: ToolContext,
  { name, equipment, muscles }: SaveCustomExerciseInput,
): Promise<WriteRunOutput> {
  const missing = [
    ...(name === null ? ["name"] : []),
    ...(equipment === null ? ["equipment"] : []),
    ...(muscles === null ? ["muscles"] : []),
  ];
  if (name === null || equipment === null || muscles === null) {
    return { data: { error: "invalid_input", fields: missing }, target: null };
  }
  const draft = { name, equipment, muscles };
  const refused = refusedDraft(draft);
  if (refused !== null) {
    return refused;
  }
  const saved = await saveExercise(ctx.caller, { draft });
  // The write has landed. Nothing below may throw, or the model would add the exercise a second time.
  return {
    data: { id: saved.id, name: saved.name, changed: true },
    structured: {
      card: buildExerciseCreatedCard(saved),
      undo: { previous: null, fingerprint: exerciseFingerprint({ ...saved, isArchived: false }) },
    },
    target: { targetId: saved.id },
  };
}
