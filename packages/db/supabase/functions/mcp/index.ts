// mcp: the MCP server over the assistant's tool registry, for Ki-Lo's own MCP client in the
// `assistant` function. It is not published or registered anywhere (ADR 0006).
//
// Things to know when changing this file:
// - Every tool in `toolRegistry` is served, so a tool added to the registry appears here with no
//   change to this function.
// - A request needs the user's JWT, `?turn=<id>` naming that user's open turn under five minutes old,
//   and `X-Kilo-Allowed-Tools` for the tools the turn may call. A missing header refuses every call.
// - It also needs `X-Kilo-Local-Date` (YYYY-MM-DD, else 400) and may send `X-Kilo-Local-Time` (HH:MM),
//   the day and hour of the turn's sheet, which a write defaults to. `tools/list` says in each tool's
//   `_meta["kilo/strict"]` whether the model's API should hold it to its schema.
// - `tools/call` answers the executor's wrapped text as `content`, which is all the model reads, and
//   its outcome as `structuredContent`, which only the turn loop reads. Nothing here logs an argument
//   or a result.
import { requireUser } from "../_shared/auth.ts";
import { toolRegistry } from "../_shared/assistant/registry.ts";
import { createActionStore } from "../_shared/assistant/store.ts";
import { createCallerClient, createServiceClient } from "../_shared/clients.ts";
import { handle } from "../_shared/http.ts";
import { reportError } from "../_shared/report.ts";
import { createMcpEndpoint } from "./routes.ts";
import { createMcpTurnStore } from "./turns.ts";

Deno.serve(
  handle("mcp", (request) => {
    const service = createServiceClient();
    return createMcpEndpoint({
      authenticate: requireUser,
      turns: createMcpTurnStore(service),
      caller: createCallerClient,
      actions: createActionStore(service),
      registry: toolRegistry,
      now: () => new Date(),
      report: reportError,
    })(request);
  }),
);
