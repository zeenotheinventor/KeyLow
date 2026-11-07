// Makes one of the user's routines the active one, or clears it, on their word. Nothing is asked first,
// because one tap reverses it. Undo puts the routine that was active back, or clears it when none was.
import { z } from "zod";

import { buildRoutineActiveCard, buildRoutineClearedCard } from "../../core.ts";
import { listRoutines, setActiveRoutine } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";

import type { InverseOutcome, ToolContext, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const setActiveRoutineInput = z.strictObject({
  routine_id: z
    .guid()
    .nullable()
    .describe("The id of the routine from get_routines, or null to leave no routine active."),
});

type SetActiveRoutineInput = z.infer<typeof setActiveRoutineInput>;

// The one routine of the caller that is active and when it became so, or "none". It is the state this write
// leaves, kept beside the card so Undo can tell that the person changed it since. The database stamps
// `activated_at` again on every activation, so the routine being made active again in the app changes it too.
// The stamp is kept exactly as the database gave it, and never reformatted.
const stateOf = (active: { id: string; activated_at: string | null } | null): string =>
  active === null ? "none" : `${active.id} ${active.activated_at ?? ""}`;

// The fingerprint of a write whose stamp could not be read after it landed. Undo then compares the routine's
// id alone, so it cannot tell that the same routine was made active again in the app, and it still tells that
// another routine, or none, is active.
const unknownStamp = "unknown";

// Makes the routine active with the database call itself. The repo helper writes and then reads the routine
// back, and a throw from either looks the same. A throw after the write landed would lose the card and Undo
// of a write, and the model would retry into `unchanged`, so this has no read-back. Null clears, and the repo
// helper has no read-back for that.
async function activateRoutine(ctx: ToolContext, routineId: string | null): Promise<void> {
  if (routineId === null) {
    await setActiveRoutine(ctx.caller, null);
    return;
  }
  const { error } = await ctx.caller.rpc("set_active_routine", { p_routine_id: routineId });
  if (error) {
    // The code only. The message can quote the routine.
    throw new Error(`Could not make the routine active (${error.code || "no code"})`);
  }
}

// When the routine became active, as the database stamped it, or null when it cannot be read. It must not throw,
// because the activation has landed.
async function activationStampOf(ctx: ToolContext, routineId: string): Promise<string | null> {
  try {
    const routines = await listRoutines(ctx.caller, { archived: true });
    return routines.find(({ id }) => id === routineId)?.activated_at ?? null;
  } catch (caught) {
    try {
      ctx.reportError("assistant tool set_active_routine", "internal_error", caught);
    } catch {
      // Reporting is a side channel.
    }
    return null;
  }
}

const previousRoutineId = z.guid().nullable();

// The answer when the routine is active already, or none is and none was asked for: nothing is written.
const unchanged = (isActive: boolean, routineId?: string): WriteRunOutput => ({
  data: {
    ...(routineId === undefined ? {} : { routine_id: routineId }),
    is_active: isActive,
    changed: false,
  },
  target: null,
});

const changedBySince: InverseOutcome = { status: "unavailable", reason: "changed" };

export const setActiveRoutineTool: WriteToolDefinition<SetActiveRoutineInput> = {
  name: "set_active_routine",
  description:
    "Makes one of the user's routines their active one, which their week plans from, or with " +
    "routine_id null leaves no routine active. Take the id from get_routines, never from memory. It " +
    "replaces whichever routine was active. Nothing is asked first, because the card has Undo. An " +
    "archived routine is refused as routine_archived, and one that is not the user's is reported as " +
    "not found. Undo makes the routine before active again, and the week then plans from the day of the " +
    "Undo and not from the original day. Say so only if asked.",
  kind: "write",
  input: setActiveRoutineInput,
  // The strict budget is spent (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "routines",
  refusesDuringWorkout: true,
  async run(ctx, { routine_id }): Promise<WriteRunOutput> {
    const routines = await listRoutines(ctx.caller, { archived: true });
    const active = routines.find((routine) => routine.is_active) ?? null;
    if (routine_id === null) {
      if (active === null) {
        return unchanged(false);
      }
      await activateRoutine(ctx, null);
      return {
        data: { is_active: false, changed: true },
        structured: {
          card: buildRoutineClearedCard({ previousName: active.name }),
          undo: { previous: active.id, fingerprint: stateOf(null) },
        },
        target: { targetId: active.id },
      };
    }
    const routine = routines.find(({ id }) => id === routine_id);
    if (routine === undefined) {
      return notFound;
    }
    if (routine.is_archived) {
      return { data: { error: "routine_archived" }, target: null };
    }
    if (routine.is_active) {
      return unchanged(true, routine_id);
    }
    await activateRoutine(ctx, routine_id);
    const stamp = await activationStampOf(ctx, routine_id);
    return {
      data: { routine_id, is_active: true, changed: true },
      structured: {
        card: buildRoutineActiveCard({
          routineId: routine_id,
          name: routine.name,
          previousName: active === null ? null : active.name,
        }),
        undo: {
          previous: active === null ? null : active.id,
          fingerprint:
            stamp === null
              ? `${routine_id} ${unknownStamp}`
              : stateOf({ id: routine_id, activated_at: stamp }),
        },
      },
      target: { targetId: routine_id },
    };
  },
  // Puts the routine before back, or clears the active routine when none was, unless the person changed which
  // routine is active since. That is the case for any other routine, and for this one made active again. The
  // routine before cannot come back once it is archived or gone.
  async inverse(ctx, action) {
    const stored = await ctx.previousValueOf(action);
    const previous = previousRoutineId.safeParse(stored?.previous);
    if (stored === null || !previous.success) {
      return "unavailable";
    }
    const routines = await listRoutines(ctx.caller, { archived: true });
    const active = routines.find((routine) => routine.is_active) ?? null;
    const isLeftAsWritten =
      stateOf(active) === stored.fingerprint ||
      (active !== null && stored.fingerprint === `${active.id} ${unknownStamp}`);
    if (!isLeftAsWritten) {
      return changedBySince;
    }
    if (previous.data !== null) {
      const before = routines.find(({ id }) => id === previous.data);
      if (before === undefined || before.is_archived) {
        return changedBySince;
      }
    }
    await activateRoutine(ctx, previous.data);
    return "undone";
  },
};
