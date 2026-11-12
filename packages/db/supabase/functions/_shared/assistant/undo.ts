// Undo of one assistant action, for the person who owns it. The tool's own `inverse` does the work
// and knows whether the target changed since the action. This file claims the action first, so two
// presses of Undo run the inverse once, and gives the claim back when the inverse could not run.
import { isWorkoutInProgress } from "./executor.ts";

import type { ToolContext, UndoReason } from "./tool.ts";

export type UndoCode = "not_found" | "already_undone" | "undo_unavailable" | "undo_failed";

export type UndoResult =
  | { status: "undone"; actionId: string }
  // `reason` is present only when the tool or the guard gave one, for the boards' notes.
  | { status: "error"; code: UndoCode; reason?: UndoReason };

function reportQuietly(ctx: ToolContext, toolName: string, caught: unknown): void {
  try {
    ctx.reportError(`assistant tool ${toolName}`, "internal_error", caught);
  } catch {
    // Reporting is a side channel.
  }
}

export async function undoAction(ctx: ToolContext, actionId: string): Promise<UndoResult> {
  const action = await ctx.actions.findAction(actionId, ctx.userId);
  if (action === null) {
    return { status: "error", code: "not_found" };
  }
  if (action.undoneAt !== null) {
    return { status: "error", code: "already_undone" };
  }
  const tool = ctx.registry.get(action.tool);
  const hasTarget =
    action.targetId !== null || action.targetIds !== null || action.targetLocalDate !== null;
  if (tool === undefined || tool.kind !== "write" || tool.inverse === null || !hasTarget) {
    return { status: "error", code: "undo_unavailable" };
  }

  // Before the claim, so the action stays undoable once the workout ends. A read that fails refuses too.
  if (tool.refusesDuringWorkout === true) {
    try {
      if (await isWorkoutInProgress(ctx)) {
        return { status: "error", code: "undo_unavailable", reason: "workout_in_progress" };
      }
    } catch (caught) {
      reportQuietly(ctx, tool.name, caught);
      return { status: "error", code: "undo_failed" };
    }
  }

  if (!(await ctx.actions.claimUndo(action.id, ctx.userId, new Date().toISOString()))) {
    return { status: "error", code: "already_undone" };
  }
  // A crash between the claim above and the inverse below leaves the action marked undone with
  // nothing reversed. That is accepted: Undo is then unavailable, and no write is ever repeated.
  try {
    const outcome = await tool.inverse(ctx, action);
    if (outcome === "undone") {
      return { status: "undone", actionId: action.id };
    }
    await ctx.actions.releaseUndoClaim(action.id, ctx.userId);
    return typeof outcome === "object"
      ? { status: "error", code: "undo_unavailable", reason: outcome.reason }
      : { status: "error", code: "undo_unavailable" };
  } catch (caught) {
    try {
      await ctx.actions.releaseUndoClaim(action.id, ctx.userId);
    } catch {
      // The claim stays, and Undo is unavailable. That is the accepted outcome above.
    }
    reportQuietly(ctx, tool.name, caught);
    return { status: "error", code: "undo_failed" };
  }
}
