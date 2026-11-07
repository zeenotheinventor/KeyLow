// The exercises and context the custom exercise write tools' tests share. Nothing in production imports
// this.
import { z } from "zod";

import { undoOutcomeSchema } from "../store.ts";
import { createFakeActionStore, createFakeContext, userId } from "../testing.ts";
import { exerciseId, exerciseRow } from "./trainingFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { ExecutionResult } from "../executor.ts";
import type { StoredUndo } from "../store.ts";
import type { ToolContext, ToolDefinition } from "../tool.ts";
import type { RpcHandler } from "./writeStub.ts";

export const otherUserId = "00000000-0000-4000-8000-0000000000b2";

// The board's Cable crunch, the user's own, and the same exercise as another person's, and a library one.
export const cableCrunch = exerciseRow(11, {
  source: "user",
  owner_id: userId,
  name: "Cable crunch",
  equipment: "cable",
  mechanic: "isolation",
  exercise_muscles: [{ muscle_id: "abs", role: "primary", weight: 1 }],
});
export const theirsCrunch = exerciseRow(12, {
  source: "user",
  owner_id: otherUserId,
  name: "Their crunch",
  equipment: "cable",
  mechanic: "isolation",
  exercise_muscles: [{ muscle_id: "abs", role: "primary", weight: 1 }],
});
export const libraryPress = exerciseRow(13, { name: "Barbell bench press" });
export const missingExerciseId = exerciseId(99);

const savePayloadSchema = z.object({
  p_exercise_id: z.string().nullable(),
  p_exercise: z.object({ name: z.string(), equipment: z.string(), mechanic: z.string() }),
  p_muscles: z.array(z.object({ muscle_id: z.string(), role: z.string(), weight: z.number() })),
});

// `save_exercise` as the database runs it: it creates the person's own exercise, or replaces the name,
// equipment, mechanic and muscle map of one of theirs. An exercise that is not theirs, a library one
// included, is no_data_found, and the cases look the same.
export const saveExerciseRpc: RpcHandler = (args, tables) => {
  const payload = savePayloadSchema.parse(args);
  const exercises = (tables["exercises"] ??= []);
  const existing =
    payload.p_exercise_id === null
      ? undefined
      : exercises.find((row) => row["id"] === payload.p_exercise_id && row["owner_id"] === userId);
  if (payload.p_exercise_id !== null && existing === undefined) {
    return { data: null, error: { code: "P0002", message: "no_data_found" } };
  }
  const fields = {
    name: payload.p_exercise.name,
    equipment: payload.p_exercise.equipment,
    mechanic: payload.p_exercise.mechanic,
    exercise_muscles: payload.p_muscles,
  };
  if (existing !== undefined) {
    Object.assign(existing, fields);
    return { data: existing["id"], error: null };
  }
  const id = exerciseId(500 + exercises.length);
  exercises.push({ id, owner_id: userId, source: "user", deleted_at: null, ...fields });
  return { data: id, error: null };
};

// A context for the tools whose caller is the in-memory training tables, with the person's own Cable crunch
// in them, another person's, and one of the library.
export function exerciseContext(
  tools: readonly ToolDefinition[],
  rows: Record<string, Record<string, unknown>[]> = {},
) {
  const stub = writeStub(
    { exercises: [cableCrunch, theirsCrunch, libraryPress], ...rows },
    { callerUserId: userId, rpc: { save_exercise: saveExerciseRpc } },
  );
  const made = createFakeContext(tools, {
    store: createFakeActionStore(),
    personsWords: "Archive exercise",
  });
  const ctx: ToolContext = { ...made.ctx, caller: stub.caller };
  return { ...made, ctx, stub };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// What a landed write stored beside its card for Undo, as the turn loop reads it from the result.
export function undoOf(result: ExecutionResult): StoredUndo {
  const structured = result.status === "ok" ? result.structured : null;
  const parsed = undoOutcomeSchema.safeParse(isRecord(structured) ? structured["undo"] : undefined);
  if (!parsed.success) {
    throw new Error("The result holds no undo");
  }
  return parsed.data;
}

// Keeps what a landed write stored for Undo with its action, which is what the turn loop does and the
// store's `previousValueOf` answers from. A test calls this where the loop would.
export function keepUndoOf(
  result: ExecutionResult,
  store: ReturnType<typeof createFakeActionStore>,
): void {
  if (result.status !== "ok" || result.actionId === null) {
    throw new Error("The result holds no action");
  }
  store.previousValues.set(result.actionId, undoOf(result));
}
