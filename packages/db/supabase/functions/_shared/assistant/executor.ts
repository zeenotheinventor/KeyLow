// The only code that runs a tool, whichever transport called it. Every guard that matters lives here
// and not in the prompt (ADR 0006): the per-turn allowlist, input validation, "writes only on the
// user's own message", the ten write slots, the confirmation protocol and the untrusted wrapper.
//
// A failure never throws to the model. It comes back as a typed result holding a code and no wording,
// and the code is the only thing Sentry hears besides the tool's name.
import { isConfirmAnswer } from "../core.ts";
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
  // `question` is the tool's own words, for the turn loop to show when the model wrote none. `note` is a line
  // the tool wrote to add after the question, and is absent when the tool had none. Neither is in `text`,
  // and neither is stored with the pending confirmation.
  | {
      status: "needs_confirmation";
      text: string;
      confirmationId: string;
      question: string;
      note?: string;
      // True when the call carried a valid confirmation but the person's message was not the confirm
      // button's words, so a new confirmation was stored and the buttons are drawn again.
      asksAgain?: true;
    }
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
    const { question, confirmLabel, note } = need;
    const hash = await inputHash(parsed.data);
    // Asks, and holds the call until the person confirms. The confirmation is stored on this turn with
    // the words of the button that confirms it. A turn holds one pending confirmation. If the model asks
    // for several in one turn, the last one stored wins and the earlier ids stop working, which is the
    // safe way round.
    const ask = async (asksAgain: boolean): Promise<ExecutionResult> => {
      const confirmationId = crypto.randomUUID();
      await ctx.actions.storePendingConfirmation(ctx.turn.id, ctx.userId, {
        id: confirmationId,
        tool: tool.name,
        inputHash: hash,
        confirmLabel,
      });
      return {
        status: "needs_confirmation",
        confirmationId,
        question,
        ...(note === undefined ? {} : { note }),
        ...(asksAgain ? { asksAgain: true as const } : {}),
        text: wrapUntrusted(tool.name, {
          status: "needs_confirmation",
          confirmation_id: confirmationId,
          ...(asksAgain ? { asked_again: true } : {}),
          ...(note === undefined ? {} : { note }),
        }),
      };
    };
    const previous = await ctx.actions.previousPendingConfirmation(
      ctx.turn.conversationId,
      ctx.userId,
      ctx.turn.id,
    );
    // The call is the one the previous turn asked about: the same tool and the same input. The hash is of
    // the input without `confirmation_id`, so it is the same whether or not the model sent the id.
    const isSameCall =
      previous !== null &&
      previous.confirmation.tool === tool.name &&
      previous.confirmation.inputHash === hash;
    // An id the model gives must be the one issued for this call. A call with no id, or a null one, has no
    // id to check, and is judged on the tool, the input and the person's words alone.
    if (
      split.confirmationId !== null &&
      !(isSameCall && previous.confirmation.id === split.confirmationId)
    ) {
      return failed(tool.name, "confirmation_invalid");
    }
    if (!isSameCall) {
      return await ask(false);
    }
    // It is spent only on the person's own next message being the words of the confirm button, compared
    // with the words stored with the confirmation, and not on the model copying an id. Anything else, and
    // anything missing, asks again and writes nothing: no slot is taken and the tool does not run. So a
    // model that misreads an answer, or text inside a tool result, cannot spend it, and one that forgets
    // the id after the button is pressed does not leave the person asked again.
    if (!isConfirmAnswer(ctx.turn.personsWords, previous.confirmation.confirmLabel)) {
      return await ask(true);
    }
    confirmedOn = { turnId: previous.turnId, confirmationId: previous.confirmation.id };
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
