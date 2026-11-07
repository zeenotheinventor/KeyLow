// The routines and context the routine state tools' tests share (`set_active_routine`, `archive_routine`).
// Nothing in production imports this.
import { undoOutcomeSchema } from "../store.ts";
import { userId } from "../testing.ts";
import { routineId, routineListRow } from "./trainingFixtures.ts";
import { structuredOf, writeContext } from "./writeFixtures.ts";

import type { ExecutionResult } from "../executor.ts";
import type { FakeActionStore } from "../testing.ts";
import type { ToolDefinition } from "../tool.ts";
import type { RpcHandler, WriteStub } from "./writeStub.ts";

export const upperLowerId = routineId(1);
export const pushPullLegsId = routineId(2);
export const fullBodyId = routineId(3);
export const otherUsersId = routineId(9);
export const otherUserId = "00000000-0000-4000-8000-0000000000b2";

const named = (number: number, name: string, overrides: Record<string, unknown> = {}) =>
  routineListRow(number, { name, ...overrides });

// Upper Lower is active, and Push Pull Legs and Full Body are not. Another person's routine is active too.
export const routineRows = () => [
  named(1, "Upper Lower", { is_active: true, activated_at: "2026-10-01T08:00:00.000000+00:00" }),
  named(2, "Push Pull Legs"),
  named(3, "Full Body"),
  named(9, "Their split", {
    user_id: otherUserId,
    is_active: true,
    activated_at: "2026-10-02T08:00:00.000000+00:00",
  }),
];

// Upper Lower is not active either, so no routine of the caller is. Another person's still is.
export const noRoutineActive = () =>
  routineRows().map((row) => (row["user_id"] === userId ? { ...row, is_active: false } : row));

let activations = 0;

// `set_active_routine` as the database answers it: one routine of the caller is active, the others are not,
// the trigger stamps `activated_at` again on every activation, an archived routine is refused with 22023 and
// one that is not the caller's is not found.
export const setActiveRoutineRpc: RpcHandler = (args, tables) => {
  const id = args["p_routine_id"];
  const mine = (tables["routines"] ?? []).filter((row) => row["user_id"] === userId);
  if (id === null) {
    mine.forEach((row) => Object.assign(row, { is_active: false }));
    return { data: null, error: null };
  }
  const target = mine.find((row) => row["id"] === id);
  if (target === undefined) {
    return { data: null, error: { code: "P0002", message: "not found" } };
  }
  if (target["is_archived"] === true) {
    return { data: null, error: { code: "22023", message: "archived" } };
  }
  activations += 1;
  mine.forEach((row) => Object.assign(row, { is_active: row === target }));
  target["activated_at"] = `2026-11-07T10:00:${String(activations).padStart(2, "0")}.000000+00:00`;
  return { data: null, error: null };
};

export function routineContext(
  tools: readonly ToolDefinition[],
  rows: Record<string, unknown>[] = routineRows(),
) {
  return writeContext(tools, {
    rows: { routines: rows },
    rpc: { set_active_routine: setActiveRoutineRpc },
  });
}

// The ids of the caller's routines that are active, and of the caller's routines that are archived.
export const activeIdsOf = (stub: WriteStub): unknown[] =>
  (stub.tables["routines"] ?? [])
    .filter((row) => row["user_id"] === userId && row["is_active"] === true)
    .map((row) => row["id"]);

export const archivedIdsOf = (stub: WriteStub): unknown[] =>
  (stub.tables["routines"] ?? [])
    .filter((row) => row["user_id"] === userId && row["is_archived"] === true)
    .map((row) => row["id"]);

// What the turn loop does with `structured.undo`: it keeps it beside the card, under the action's id, and
// `previousValueOf` reads it back from there.
export function storeUndoOf(store: FakeActionStore, result: ExecutionResult): void {
  if (result.status === "ok" && result.actionId !== null) {
    store.previousValues.set(
      result.actionId,
      undoOutcomeSchema.parse(structuredOf(result)["undo"]),
    );
  }
}
