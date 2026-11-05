// assistant: the one Edge Function behind the in-app assistant. It checks who may take a turn
// (the kill switch, consent, the entitlement, the daily turns, the monthly spend), and serves the
// status, turn, conversations and undo routes. The turn loop itself is `turn.ts`.
//
// Things to know when changing this file:
// - Every failed gate is a typed notice with a code, never words. The app words it from core.
// - Nothing here logs or reports the message text. A log line holds the user, the route, the gate
//   and the duration.
import { requireUser } from "../_shared/auth.ts";
import { toolRegistry } from "../_shared/assistant/registry.ts";
import { createActionStore } from "../_shared/assistant/store.ts";
import { undoAction } from "../_shared/assistant/undo.ts";
import { createCallerClient, createServiceClient } from "../_shared/clients.ts";
import { handle } from "../_shared/http.ts";
import { reportError } from "../_shared/report.ts";
import { runInBackground } from "../_shared/runtime.ts";
import { createAccessStore } from "./gates.ts";
import { createAssistantHandler } from "./routes.ts";
import { createModelClient, createRunTurn, createToolListCache } from "./turn.ts";
import { createTurnStore } from "./turnStore.ts";
import { recordUsage } from "./usage.ts";

import { connectToolServer } from "../_shared/assistant/mcpClient.ts";

import type { ToolContext } from "../_shared/assistant/tool.ts";

const nilId = "00000000-0000-0000-0000-000000000000";

// One for the life of the function instance, because a request builds the handler anew.
const toolListCache = createToolListCache();

Deno.serve(
  handle("assistant", (request) => {
    const service = createServiceClient();
    const turns = createTurnStore(service);
    const handler = createAssistantHandler({
      authenticate: requireUser,
      access: createAccessStore(service),
      turns,
      undoWith: (undoRequest, userId) => {
        // Undo runs outside a turn, so the context carries a nil turn, no message and no day.
        const context: ToolContext = {
          caller: createCallerClient(undoRequest),
          actions: createActionStore(service),
          userId,
          turn: {
            id: nilId,
            conversationId: nilId,
            userMessageText: null,
            personsWords: null,
            localDate: "1970-01-01",
            localTime: null,
          },
          registry: toolRegistry,
          allowedTools: undefined,
          reportError,
        };
        return (actionId) => undoAction(context, actionId);
      },
      runTurn: createRunTurn({
        turns,
        toolListCache,
        recordUsage: (call) => recordUsage(service, call),
        runInBackground,
        connect: connectToolServer,
        // Made per turn from the secrets, so a missing key ends that turn and never stops the boot.
        createModelClient: () => createModelClient((name) => Deno.env.get(name)),
        availableTools: toolRegistry.list.map((tool) => ({
          name: tool.name,
          readOnlyHint: tool.annotations.readOnlyHint,
        })),
        functionsBaseUrl: () => Deno.env.get("SUPABASE_URL"),
        report: reportError,
        now: () => new Date(),
      }),
      now: () => new Date(),
      report: reportError,
    });
    return handler(request);
  }),
);
