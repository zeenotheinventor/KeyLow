// Adds one of the user's own exercises, or changes one, as the New exercise form does, with a card and
// Undo. No screen edits or archives a custom exercise, so the card has no link and this tool is the only way
// to do either. An edit never touches the sets already logged, which hold a snapshot of the exercise as it
// was. The previous value goes beside the card for Undo and never reaches the model.
import { z } from "zod";

import {
  buildExerciseCreatedCard,
  buildExerciseUpdatedCard,
  customExercisePayload,
  validateCustomExerciseDraft,
} from "../../core.ts";
import { archiveExercise } from "../../repos.ts";
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

import type { Database } from "../../core/database.types.ts";
import type { CleanCustomExercise, CustomExerciseDraft } from "../../core.ts";
import type { ExerciseState } from "./exerciseWrite.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
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
    .describe("The id of the user's own exercise to change, or null to add one."),
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .default(null)
    .describe("Needed to add one. When changing, null keeps it."),
  equipment: equipmentSchema
    .nullable()
    .default(null)
    .describe("Needed to add one. When changing, null keeps it."),
  muscles: z
    .array(muscleInput)
    .min(1)
    .max(22)
    .nullable()
    .default(null)
    .describe(
      "Every muscle it works with its role, at least one primary. Needed to add one. When changing, a list replaces the whole map and null keeps it.",
    ),
});

type SaveCustomExerciseInput = z.infer<typeof saveCustomExerciseInput>;

type Checked = { clean: CleanCustomExercise } | { refused: WriteRunOutput };

// The draft as core cleans it, or the fields it names and the rules that broke, in the order of the form. A
// rule is a stable code and never carries a value.
function checkedDraft(draft: CustomExerciseDraft): Checked {
  const checked = validateCustomExerciseDraft(draft);
  if (checked.ok) {
    return { clean: checked.value };
  }
  return {
    refused: {
      data: {
        error: "invalid_input",
        fields: [...new Set(checked.problems.map(({ field }) => field))],
        rules: checked.problems.map(({ rule }) => rule),
      },
      target: null,
    },
  };
}

const saveExerciseFunction = "save_exercise" satisfies keyof Database["public"]["Functions"];
type SaveExerciseArguments = Database["public"]["Functions"]["save_exercise"]["Args"];

// Saves the exercise with the database call itself. The repo helper calls it and then reads the exercise
// back, and a throw from either looks the same. A throw after the call landed would lose the card and Undo
// of a write, and the model would retry into a second exercise. So an error here means nothing was written,
// and what the write left is worked out from the input, with the id the call returned. The generated types
// take a plain string for the id, which is null to add, so the client is untyped and the arguments are tied
// to the generated ones with `satisfies`.
async function saveThroughDatabase(
  ctx: ToolContext,
  id: string | null,
  clean: CleanCustomExercise,
): Promise<{ id: string | null; after: Saved }> {
  const { p_exercise, p_muscles } = customExercisePayload(clean);
  const untypedCaller: SupabaseClient = ctx.caller;
  const { data, error } = await untypedCaller.rpc(saveExerciseFunction, {
    p_exercise_id: id,
    p_exercise,
    p_muscles: [...p_muscles],
  } satisfies Omit<SaveExerciseArguments, "p_exercise_id"> & { p_exercise_id: string | null });
  if (error) {
    // The code only. The message can quote the exercise.
    throw new Error(`Could not save the exercise (${error.code || "no code"})`);
  }
  return {
    id: typeof data === "string" ? data : id,
    after: {
      name: p_exercise.name,
      equipment: p_exercise.equipment,
      mechanic: p_exercise.mechanic,
      muscles: [...p_muscles],
      isArchived: false,
    },
  };
}

// What a save left, as it is stored.
type Saved = Pick<ExerciseState, "name" | "equipment" | "mechanic" | "muscles" | "isArchived">;

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
    "its id from search_exercises and only the fields that change, null for the rest. Muscles replaces " +
    "the whole map, so send all the muscles search_exercises gives for that exercise, with " +
    "their roles, and only what the user asked added, removed or changed. Never " +
    "drop a muscle the user did not mention. An exercise of the library cannot be " +
    "changed: the call answers global_exercise, so tell the user and offer to add their own. Sets the " +
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
    const checked = checkedDraft(draft);
    if ("refused" in checked) {
      return checked.refused;
    }
    if (sameDraft(draft, draftOf(state))) {
      return { data: { id: input.id, changed: false }, target: null };
    }
    const { after } = await saveThroughDatabase(ctx, input.id, checked.clean);
    // The write has landed. Nothing below may throw, or the model would save the change a second time.
    return {
      data: { id: input.id, name: after.name, changed: true },
      structured: {
        card: buildExerciseUpdatedCard({ before: state, after }),
        undo: { previous: draftOf(state), fingerprint: exerciseFingerprint(after) },
      },
      target: { targetId: input.id },
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
    const checked = checkedDraft(previous.data);
    if ("refused" in checked) {
      return "unavailable";
    }
    await saveThroughDatabase(ctx, targetId, checked.clean);
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
  const checked = checkedDraft({ name, equipment, muscles });
  if ("refused" in checked) {
    return checked.refused;
  }
  const { id, after } = await saveThroughDatabase(ctx, null, checked.clean);
  // The write has landed. Nothing below may throw, or the model would add the exercise a second time.
  const card = buildExerciseCreatedCard(after);
  if (id === null) {
    // The database answered with no id, which it never does. Without one there is no action to undo.
    return {
      data: { name: after.name, changed: true },
      structured: { card: { ...card, undo: "unavailable", undoneSub: null } },
      target: null,
    };
  }
  return {
    data: { id, name: after.name, changed: true },
    structured: { card, undo: { previous: null, fingerprint: exerciseFingerprint(after) } },
    target: { targetId: id },
  };
}
