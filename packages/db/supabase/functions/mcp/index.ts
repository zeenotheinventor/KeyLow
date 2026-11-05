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
// - `import_recipe_from_url` is the one tool that reaches outside: it fetches a recipe page and makes one
//   tool-less Haiku call, so this function reads `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` too.
// - `tools/call` answers the executor's wrapped text as `content`, which is all the model reads, and
//   its outcome as `structuredContent`, which only the turn loop reads. Nothing here logs an argument
//   or a result.
import { requireUser } from "../_shared/auth.ts";
import { createRecipeImportServices } from "../_shared/assistant/recipeParse.ts";
import { toolRegistry } from "../_shared/assistant/registry.ts";
import { createActionStore } from "../_shared/assistant/store.ts";
import { createCallerClient, createServiceClient } from "../_shared/clients.ts";
import { handle } from "../_shared/http.ts";
import { fetchRecipePage } from "../_shared/recipePage.ts";
import { recipePageTestOverrides } from "../_shared/recipePageTestOrigin.ts";
import { reportError } from "../_shared/report.ts";
import { recordUsage } from "../assistant/usage.ts";
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
      // `import_recipe_from_url` reads the Anthropic key from this function's environment, which is the
      // project's function secrets, the same ones the `assistant` function reads.
      recipeImport: createRecipeImportServices({
        readEnv: (name) => Deno.env.get(name),
        recordUsage: (call) => recordUsage(service, call),
        report: reportError,
        // The overrides are empty unless the environment names a test origin and a local stack (the recipe import evals, KEY-701).
        fetchPage: (url, timeoutMilliseconds) =>
          fetchRecipePage(url, {
            timeoutMilliseconds,
            ...recipePageTestOverrides((name) => Deno.env.get(name)),
          }),
      }),
      now: () => new Date(),
      report: reportError,
    })(request);
  }),
);
