// Undo of one assistant action, for the person who owns it. The tool's own `inverse` does the work
// and knows whether the target changed since the action. This file claims the action first, so two
// presses of Undo run the inverse once, and gives the claim back when the inverse could not run.
import type { ToolContext } from "./tool.ts";

export type UndoCode = "not_found" | "already_undone" | "undo_unavailable" | "undo_failed";

export type UndoResult =
  { status: "undone"; actionId: string } | { status: "error"; code: UndoCode };

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

  if (!(await ctx.actions.claimUndo(action.id, ctx.userId, new Date().toISOString()))) {
    return { status: "error", code: "already_undone" };
  }
  // A crash between the claim above and the inverse below leaves the action marked undone with
  // nothing reversed. That is accepted: Undo is then unavailable, and no write is ever repeated.
  try {
    if ((await tool.inverse(ctx, action)) === "undone") {
      return { status: "undone", actionId: action.id };
    }
    await ctx.actions.releaseUndoClaim(action.id, ctx.userId);
    return { status: "error", code: "undo_unavailable" };
  } catch (caught) {
    try {
      await ctx.actions.releaseUndoClaim(action.id, ctx.userId);
      ctx.reportError(`assistant tool ${tool.name}`, "internal_error", caught);
    } catch {
      // Reporting is a side channel.
    }
    return { status: "error", code: "undo_failed" };
  }
}
