// The only code that runs a tool, whichever transport called it. Every guard that matters lives here
// and not in the prompt (ADR 0006): the per-turn allowlist, input validation, "writes only on the
// user's own message", the ten write slots, the confirmation protocol and the untrusted wrapper.
//
// A failure never throws to the model. It comes back as a typed result holding a code and no wording,
// and the code is the only thing Sentry hears besides the tool's name.
import { inputHash } from "./inputHash.ts";
import { reserveNextSlot } from "./store.ts";
import { confirmationIdKey, parseToolInput } from "./tool.ts";
import { wrapUntrusted } from "./untrusted.ts";

import type { ToolContext, ToolDefinition, WriteToolDefinition } from "./tool.ts";
import type { JsonValue } from "./untrusted.ts";

export type ToolErrorCode =
  | "tool_not_allowed"
  | "unknown_tool"
  | "no_user_message"
  | "invalid_input"
  | "write_limit_reached"
  | "confirmation_invalid"
  | "tool_failed";

export type ExecutionResult =
  // `text` is what the model reads. `structured` is for the turn loop only.
  | { status: "ok"; text: string; structured: JsonValue | null; actionId: string | null }
  // `note` is a line the tool wrote for the turn loop to add after the model's question. It is absent when
  // the tool had none, and it is never stored with the pending confirmation.
  | { status: "needs_confirmation"; text: string; confirmationId: string; note?: string }
  | { status: "error"; code: ToolErrorCode; text: string };

function failed(
  toolName: string,
  code: ToolErrorCode,
  details: { [key: string]: JsonValue } = {},
): ExecutionResult {
  return { status: "error", code, text: wrapUntrusted(toolName, { error: code, ...details }) };
}

function report(ctx: ToolContext, toolName: string, caught: unknown): void {
  try {
    ctx.reportError(`assistant tool ${toolName}`, "internal_error", caught);
  } catch {
    // Reporting is a side channel and must not change the answer.
  }
}

async function releaseQuietly(ctx: ToolContext, toolName: string, actionId: string): Promise<void> {
  try {
    await ctx.actions.release(actionId, ctx.userId);
  } catch (caught) {
    report(ctx, toolName, caught);
  }
}

// `confirmation_id` belongs to the protocol and not to the tool, so it is taken off before the tool's
// own schema sees the input. Null means the model has no id to give.
type SplitInput = { valid: true; confirmationId: string | null; rest: unknown } | { valid: false };

function splitConfirmationId(rawInput: unknown): SplitInput {
  if (typeof rawInput !== "object" || rawInput === null || Array.isArray(rawInput)) {
    return { valid: true, confirmationId: null, rest: rawInput };
  }
  const { [confirmationIdKey]: given, ...rest } = Object.fromEntries(Object.entries(rawInput));
  if (given === undefined || given === null) {
    return { valid: true, confirmationId: null, rest };
  }
  return typeof given === "string"
    ? { valid: true, confirmationId: given, rest }
    : { valid: false };
}

export async function executeTool(
  ctx: ToolContext,
  name: string,
  rawInput: unknown,
): Promise<ExecutionResult> {
  // Before anything else, and a missing set refuses everything, so a caller that forgets it fails closed.
  if (ctx.allowedTools === undefined || !ctx.allowedTools.has(name)) {
    return failed(name, "tool_not_allowed");
  }
  const tool = ctx.registry.get(name);
  if (tool === undefined) {
    return failed(name, "unknown_tool");
  }
  try {
    return tool.kind === "read"
      ? await runRead(ctx, tool, rawInput)
      : await runWrite(ctx, tool, rawInput);
  } catch (caught) {
    report(ctx, name, caught);
    return failed(name, "tool_failed");
  }
}

async function runRead(
  ctx: ToolContext,
  tool: Extract<ToolDefinition, { kind: "read" }>,
  rawInput: unknown,
): Promise<ExecutionResult> {
  const parsed = parseToolInput(tool, rawInput);
  if (!parsed.success) {
    return failed(tool.name, "invalid_input", { fields: parsed.fields });
  }
  const output = await tool.run(ctx, parsed.data);
  return {
    status: "ok",
    text: wrapUntrusted(tool.name, output.data, ctx.userId),
    structured: output.structured ?? null,
    actionId: null,
  };
}

async function runWrite(
  ctx: ToolContext,
  tool: WriteToolDefinition,
  rawInput: unknown,
): Promise<ExecutionResult> {
  // A turn exists because the user sent a message. Without one, nothing is written.
  if ((ctx.turn.userMessageText ?? "").trim() === "") {
    return failed(tool.name, "no_user_message");
  }
  const split =
    tool.needsConfirmation === undefined
      ? { valid: true as const, confirmationId: null, rest: rawInput }
      : splitConfirmationId(rawInput);
  if (!split.valid) {
    return failed(tool.name, "invalid_input", { fields: [confirmationIdKey] });
  }
  const parsed = parseToolInput(tool, split.rest);
  if (!parsed.success) {
    return failed(tool.name, "invalid_input", { fields: parsed.fields });
  }

  // The previous turn that holds the confirmation this call carries, when the call needs one.
  let confirmedOn: { turnId: string; confirmationId: string } | null = null;
  const need =
    tool.needsConfirmation === undefined ? false : await tool.needsConfirmation(parsed.data, ctx);
  if (need !== false) {
    const note = typeof need === "object" ? need.note : undefined;
    const hash = await inputHash(parsed.data);
    if (split.confirmationId === null) {
      const confirmationId = crypto.randomUUID();
      // A turn holds one pending confirmation. If the model asks for several in one turn, the last
      // one stored wins and the earlier ids stop working, which is the safe way round.
      await ctx.actions.storePendingConfirmation(ctx.turn.id, ctx.userId, {
        id: confirmationId,
        tool: tool.name,
        inputHash: hash,
      });
      return {
        status: "needs_confirmation",
        confirmationId,
        ...(note === undefined ? {} : { note }),
        text: wrapUntrusted(tool.name, {
          status: "needs_confirmation",
          confirmation_id: confirmationId,
          ...(note === undefined ? {} : { note }),
        }),
      };
    }
    const previous = await ctx.actions.previousPendingConfirmation(
      ctx.turn.conversationId,
      ctx.userId,
      ctx.turn.id,
    );
    if (
      previous === null ||
      previous.confirmation.id !== split.confirmationId ||
      previous.confirmation.tool !== tool.name ||
      previous.confirmation.inputHash !== hash
    ) {
      return failed(tool.name, "confirmation_invalid");
    }
    confirmedOn = { turnId: previous.turnId, confirmationId: split.confirmationId };
  }

  const reservation = await reserveNextSlot(ctx.actions, {
    userId: ctx.userId,
    conversationId: ctx.turn.conversationId,
    turnId: ctx.turn.id,
    tool: tool.name,
    targetTable: tool.targetTable,
  });
  if (reservation.outcome === "limit_reached") {
    return failed(tool.name, "write_limit_reached");
  }
  const { actionId } = reservation;

  // Spent only now that a slot is held. Two calls with one id can both pass the check above, and
  // the update that clears it lets one of them through.
  if (confirmedOn !== null) {
    const spent = await ctx.actions.spendPendingConfirmation(
      confirmedOn.turnId,
      ctx.userId,
      confirmedOn.confirmationId,
    );
    if (!spent) {
      await releaseQuietly(ctx, tool.name, actionId);
      return failed(tool.name, "confirmation_invalid");
    }
  }

  let output;
  try {
    output = await tool.run(ctx, parsed.data);
  } catch (caught) {
    await releaseQuietly(ctx, tool.name, actionId);
    report(ctx, tool.name, caught);
    return failed(tool.name, "tool_failed");
  }

  // A write that changed nothing (a day already in the state asked for) leaves no action to undo.
  if (output.target === null) {
    await releaseQuietly(ctx, tool.name, actionId);
    return okWrite(ctx, tool.name, output, null);
  }
  try {
    await ctx.actions.fillTarget(actionId, ctx.userId, output.target);
  } catch (caught) {
    // The write has landed, so the slot stays. Only Undo is lost.
    report(ctx, tool.name, caught);
  }
  return okWrite(ctx, tool.name, output, actionId);
}

// The write has landed by now, so a result that cannot be written out (a circular value, say) must not
// turn into a failure the model would retry. It gets a minimal text, and the fault is reported.
function okWrite(
  ctx: ToolContext,
  toolName: string,
  output: { data: JsonValue; structured?: JsonValue },
  actionId: string | null,
): ExecutionResult {
  let text: string;
  try {
    text = wrapUntrusted(toolName, output.data, ctx.userId);
  } catch (caught) {
    report(ctx, toolName, caught);
    text = wrapUntrusted(toolName, { status: "done" });
  }
  return { status: "ok", text, structured: output.structured ?? null, actionId };
}
