// The `mcp` function's one route: JSON-RPC over Streamable HTTP, stateless (a new server per request,
// no session id). The only caller is Ki-Lo's own `assistant` function, which sends the user's JWT, the
// turn id in `?turn=` and the turn's allowed tools in `X-Kilo-Allowed-Tools` on every request. The
// function is still reachable from the internet, so a request is served only when the JWT is the
// user's, and the turn is that user's, open, and under five minutes old. A log line holds the user,
// the tool, a code and the duration, never an argument or a result.
import { createMcpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";

import { executeTool } from "../_shared/assistant/executor.ts";
import { wrapUntrusted } from "../_shared/assistant/untrusted.ts";
import { error } from "../_shared/http.ts";
import { createToolServer } from "./server.ts";

import type { ExecutionResult } from "../_shared/assistant/executor.ts";
import type { ActionStore } from "../_shared/assistant/store.ts";
import type { RecipeImportServices } from "../_shared/assistant/recipeParse.ts";
import type { ToolContext, ToolRegistry } from "../_shared/assistant/tool.ts";
import type { Database } from "../_shared/core/database.types.ts";
import type { ReportError } from "../_shared/report.ts";
import type { McpTurn, McpTurnStore } from "./turns.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type McpDependencies = {
  authenticate(request: Request): Promise<{ id: string } | Response>;
  turns: McpTurnStore;
  // Acts as the caller under the request's JWT, so row-level security scopes every read.
  caller(request: Request): SupabaseClient<Database>;
  actions: ActionStore;
  registry: ToolRegistry;
  // The page fetch and the parse call of `import_recipe_from_url`. A test that does not call that tool leaves
  // it out, and then the tool answers `tool_failed`.
  recipeImport?: RecipeImportServices;
  now(): Date;
  report: ReportError;
};

const allowedToolsHeader = "x-kilo-allowed-tools";
const localDateHeader = "x-kilo-local-date";
const localTimeHeader = "x-kilo-local-time";
const turnMaxAgeMilliseconds = 5 * 60 * 1000;

const turnIdSchema = z.guid();
const localDateSchema = z.iso.date();
const localTimeSchema = z.iso.time({ precision: -1 });

// The day the sheet was opened on and, when the Describe sheet knows it, the hour. Ki-Lo's own client
// sends them on every request, because a write defaults to them when the person names no day or time.
function localMomentOf(request: Request): { localDate: string; localTime: string | null } | null {
  const date = localDateSchema.safeParse(request.headers.get(localDateHeader));
  const timeHeader = request.headers.get(localTimeHeader);
  const time = timeHeader === null ? null : localTimeSchema.safeParse(timeHeader);
  if (!date.success || (time !== null && !time.success)) {
    return null;
  }
  return { localDate: date.data, localTime: time === null ? null : time.data };
}

// An absent header is an empty set, and then the executor refuses every call.
function allowedToolsOf(request: Request): ReadonlySet<string> {
  const names = (request.headers.get(allowedToolsHeader) ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return new Set(names);
}

function logGate(userId: string, gate: string, startedAt: number): void {
  console.log(
    `mcp gate user=${userId} gate=${gate} ${Math.round(performance.now() - startedAt)}ms`,
  );
}

export function createMcpEndpoint(
  dependencies: McpDependencies,
): (request: Request) => Promise<Response> {
  const { turns, registry, now } = dependencies;

  function serve(
    request: Request,
    user: { id: string },
    turn: McpTurn,
    localMoment: { localDate: string; localTime: string | null },
  ): Promise<Response> {
    const caller = dependencies.caller(request);
    const allowedTools = allowedToolsOf(request);

    async function callTool(name: string, rawInput: unknown): Promise<ExecutionResult> {
      const startedAt = performance.now();
      // The name comes from the client, so only a registered one is written to the log or the result.
      const knownName = registry.get(name) === undefined ? "unknown" : name;
      const result = await runTool(name, knownName, rawInput);
      const code = result.status === "error" ? result.code : result.status;
      const milliseconds = Math.round(performance.now() - startedAt);
      console.log(`mcp call user=${user.id} tool=${knownName} code=${code} ${milliseconds}ms`);
      return result;
    }

    async function runTool(
      name: string,
      knownName: string,
      rawInput: unknown,
    ): Promise<ExecutionResult> {
      let userMessageText: string | null;
      try {
        userMessageText = await turns.userMessageText(user.id, turn);
      } catch (caught) {
        // The transport would answer a throw with its message, and a store message can quote a row.
        dependencies.report("mcp", "internal_error", caught);
        return {
          status: "error",
          code: "tool_failed",
          text: wrapUntrusted(knownName, { error: "tool_failed" }),
        };
      }
      const context: ToolContext = {
        caller,
        actions: dependencies.actions,
        userId: user.id,
        turn: {
          id: turn.id,
          conversationId: turn.conversationId,
          userMessageText,
          ...localMoment,
        },
        registry,
        allowedTools,
        reportError: dependencies.report,
        ...(dependencies.recipeImport === undefined
          ? {}
          : { recipeImport: dependencies.recipeImport }),
      };
      return await executeTool(context, name, rawInput);
    }

    // One server and one transport per request: an Edge Function holds nothing between requests.
    return createMcpHandler(() => createToolServer(registry, callTool), {
      // A transport or factory failure reaches Sentry. The reporter drops the message.
      onerror: (caught) => dependencies.report("mcp", "internal_error", caught),
    }).fetch(request);
  }

  return async (request) => {
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    const startedAt = performance.now();
    const user = await dependencies.authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const turnId = turnIdSchema.safeParse(new URL(request.url).searchParams.get("turn"));
    if (!turnId.success) {
      return error("invalid_request", "Send the id of the open turn as ?turn=.");
    }
    const localMoment = localMomentOf(request);
    if (localMoment === null) {
      return error(
        "invalid_request",
        "Send the day as X-Kilo-Local-Date, YYYY-MM-DD, and the time, if any, as X-Kilo-Local-Time, HH:MM.",
      );
    }
    const turn = await turns.findTurn(user.id, turnId.data);
    const open =
      turn !== null &&
      turn.status === "open" &&
      now().getTime() - turn.createdAt.getTime() < turnMaxAgeMilliseconds;
    if (!open) {
      logGate(user.id, "turn_not_open", startedAt);
      return error("unauthorized", "That turn is not open.");
    }
    return await serve(request, user, turn, localMoment);
  };
}
