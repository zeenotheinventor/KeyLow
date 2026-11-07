// Makes one of the user's routines the active one, or clears it, on their word. Nothing is asked first,
// because one tap reverses it. Undo puts the routine that was active back, or clears it when none was.
import { z } from "zod";

import { buildRoutineActiveCard, buildRoutineClearedCard } from "../../core.ts";
import { listRoutines, setActiveRoutine } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";

import type { InverseOutcome, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

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
      await setActiveRoutine(ctx.caller, null);
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
    const stored = await setActiveRoutine(ctx.caller, routine_id);
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
          fingerprint: stateOf({ id: routine_id, activated_at: stored?.activated_at ?? null }),
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
    if (stateOf(active) !== stored.fingerprint) {
      return changedBySince;
    }
    if (previous.data !== null) {
      const before = routines.find(({ id }) => id === previous.data);
      if (before === undefined || before.is_archived) {
        return changedBySince;
      }
    }
    await setActiveRoutine(ctx.caller, previous.data);
    return "undone";
  },
};
