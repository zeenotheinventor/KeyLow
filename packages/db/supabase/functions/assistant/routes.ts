// The four routes of the `assistant` function, behind the sign-in check every function does itself:
//   GET  status         the notice that stops the assistant, or null, without using a turn
//   POST turn           the access gates, then the turn's rows, then the turn loop, as a stream
//   POST conversations  an empty conversation for the verified user
//   POST undo           undo of the actions a card names
// A gate failure on `turn` is a notice inside the stream, so the app has one way to read a turn. The
// only JSON failures are a bad sign-in, a bad body and an unknown route. The log lines hold the user,
// the route, the gate and the duration, never the message.
import { z } from "zod";

import { maxWritesPerTurn } from "../_shared/assistant/store.ts";
import { assistantTurnRequestSchema } from "../_shared/core.ts";
import { error, json } from "../_shared/http.ts";
import { logLine } from "../_shared/log.ts";
import { checkAccess } from "./gates.ts";
import { createEventStream, endAsFailed, eventResponse, writeEvent } from "./sse.ts";
import { ConversationBusyError } from "./turnStore.ts";

import type { UndoReason } from "../_shared/assistant/tool.ts";
import type { UndoResult } from "../_shared/assistant/undo.ts";
import type { AssistantNotice } from "../_shared/core.ts";
import type { ReportError } from "../_shared/report.ts";
import type { AccessStore } from "./gates.ts";
import type { RunTurn } from "./runTurn.ts";
import type { EventStream } from "./sse.ts";
import type { TurnStore } from "./turnStore.ts";

export type AssistantDependencies = {
  authenticate(request: Request): Promise<{ id: string } | Response>;
  access: AccessStore;
  turns: TurnStore;
  // Undo for the caller: acts under their JWT, so row-level security scopes it.
  undoWith(request: Request, userId: string): (actionId: string) => Promise<UndoResult>;
  runTurn: RunTurn;
  now(): Date;
  report: ReportError;
};

// The same shape as the core `assistantIdSchema`, which core's entry point does not export.
const undoRequestSchema = z.strictObject({
  actionIds: z.array(z.guid()).min(1).max(maxWritesPerTurn),
});

type UndoCode = "undone" | "already_undone" | "undo_unavailable" | "not_found";

// The route is the last path segment, whether the gateway keeps the `/functions/v1` prefix or not.
function routeOf(request: Request): string {
  return new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function logRoute(route: string, userId: string, gate: string, startedAt: number): void {
  const milliseconds = Math.round(performance.now() - startedAt);
  logLine("info", "assistant route", { route, user: userId, gate, milliseconds });
}

// The undo code the app knows. A failed inverse is reported by the undo itself and reads as unavailable.
function toUndoCode(result: UndoResult): UndoCode {
  if (result.status === "undone") {
    return "undone";
  }
  return result.code === "undo_failed" ? "undo_unavailable" : result.code;
}

export function createAssistantHandler(
  dependencies: AssistantDependencies,
): (request: Request) => Promise<Response> {
  const { access, turns, now } = dependencies;

  async function status(userId: string, startedAt: number): Promise<Response> {
    const notice = await checkAccess({ userId, store: access, now: now() }, { spend: false });
    logRoute("status", userId, notice?.code ?? "open", startedAt);
    return json({ notice });
  }

  async function conversations(userId: string, startedAt: number): Promise<Response> {
    const conversationId = await turns.createConversation(userId);
    logRoute("conversations", userId, "none", startedAt);
    return json({ conversationId });
  }

  async function undo(request: Request, userId: string, startedAt: number): Promise<Response> {
    const parsed = undoRequestSchema.safeParse(await readBody(request));
    if (!parsed.success) {
      return error("invalid_request", "Send the ids of the actions to undo.");
    }
    const undoOne = dependencies.undoWith(request, userId);
    const results: { actionId: string; result: UndoCode; reason?: UndoReason }[] = [];
    for (const actionId of parsed.data.actionIds) {
      const outcome = await undoOne(actionId);
      const reason = outcome.status === "error" ? outcome.reason : undefined;
      results.push({
        actionId,
        result: toUndoCode(outcome),
        ...(reason === undefined ? {} : { reason }),
      });
    }
    logRoute("undo", userId, "none", startedAt);
    return json({ results });
  }

  async function turn(request: Request, userId: string, startedAt: number): Promise<Response> {
    const parsed = assistantTurnRequestSchema.safeParse(await readBody(request));
    if (!parsed.success) {
      return error("invalid_request", "That is not a valid turn.");
    }
    const { stream, body } = createEventStream();
    void runInStream(stream, async () => {
      const gate = await streamTurn(request, userId, parsed.data, stream);
      logRoute("turn", userId, gate, startedAt);
    });
    return eventResponse(body);
  }

  // Answers the gate that stopped the turn, or "open" when the turn ran.
  async function streamTurn(
    request: Request,
    userId: string,
    input: z.infer<typeof assistantTurnRequestSchema>,
    stream: EventStream,
  ): Promise<string> {
    const notice = await checkAccess({ userId, store: access, now: now() }, { spend: true });
    if (notice !== null) {
      sendNotice(stream, notice);
      return notice.code;
    }
    if (
      input.conversationId !== null &&
      !(await turns.ownsConversation(userId, input.conversationId))
    ) {
      sendNotice(stream, { code: "turn_failed" });
      return "conversation_not_found";
    }
    const conversationId = input.conversationId ?? (await turns.createConversation(userId));
    const started = await startTurnUnlessBusy(userId, conversationId, input.text);
    if (started === null) {
      // A double tap or a second device. The app shows the failed-turn board, with "Try again".
      sendNotice(stream, { code: "turn_failed" });
      return "conversation_busy";
    }
    const { turnId, userMessageId } = started;
    await dependencies.runTurn(
      {
        userId,
        conversationId,
        turnId,
        userMessageId,
        text: input.text,
        localDate: input.localDate,
        localTime: input.localTime,
        request,
      },
      stream,
    );
    return "open";
  }

  async function startTurnUnlessBusy(userId: string, conversationId: string, text: string) {
    try {
      return await turns.startTurn({ userId, conversationId, text });
    } catch (caught) {
      if (caught instanceof ConversationBusyError) {
        return null;
      }
      throw caught;
    }
  }

  // Whatever the turn did, the stream ends, and a throw ends it as a failed turn.
  async function runInStream(stream: EventStream, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (caught) {
      dependencies.report("assistant", "internal_error", caught);
      endAsFailed(stream);
    } finally {
      stream.close();
    }
  }

  function sendNotice(stream: EventStream, notice: AssistantNotice): void {
    writeEvent(stream, { type: "notice", notice }, dependencies.report);
    writeEvent(stream, { type: "done", outcome: "failed" }, dependencies.report);
  }

  return async (request) => {
    const startedAt = performance.now();
    const user = await dependencies.authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const route = routeOf(request);
    if (route === "status" && request.method === "GET") {
      return await status(user.id, startedAt);
    }
    if (request.method === "POST") {
      if (route === "turn") {
        return await turn(request, user.id, startedAt);
      }
      if (route === "conversations") {
        return await conversations(user.id, startedAt);
      }
      if (route === "undo") {
        return await undo(request, user.id, startedAt);
      }
    }
    return error("not_found", "There is no such route.");
  };
}
