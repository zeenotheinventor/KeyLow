// The MCP server for one request: a low-level `Server` that lists the registry's tools and runs a
// call through the executor. It is built from raw JSON Schema and not from `registerTool`, because the
// schema the model sees is the registry's strict one (`toJsonSchema`) and the executor, not the SDK,
// validates every input, so a bad input comes back as the executor's `invalid_input`.
import { Server } from "@modelcontextprotocol/server";

import type { ExecutionResult } from "../_shared/assistant/executor.ts";
import type { ToolRegistry } from "../_shared/assistant/tool.ts";
import { strictMetaKey, toJsonSchema } from "../_shared/assistant/tool.ts";
import type { CallToolResult } from "@modelcontextprotocol/server";

export const serverInfo = { name: "kilo-assistant-tools", version: "1.0.0" };

export type CallTool = (name: string, rawInput: unknown) => Promise<ExecutionResult>;

// `text` is the only part the model reads. `structuredContent` is for Ki-Lo's own turn loop, which
// builds the app's events from it and never forwards it to the model. It holds the executor's outcome
// without `text`, so the two channels do not repeat each other.
export function toCallToolResult(result: ExecutionResult): CallToolResult {
  const content = [{ type: "text" as const, text: result.text }];
  switch (result.status) {
    case "ok":
      return {
        content,
        structuredContent: {
          status: "ok",
          structured: result.structured,
          actionId: result.actionId,
        },
      };
    case "needs_confirmation":
      return {
        content,
        structuredContent: { status: "needs_confirmation", confirmationId: result.confirmationId },
      };
    case "error":
      return { content, isError: true, structuredContent: { status: "error", code: result.code } };
  }
}

export function createToolServer(registry: ToolRegistry, callTool: CallTool): Server {
  const server = new Server(serverInfo, { capabilities: { tools: {} } });
  // The list never depends on the turn, so the model's tool list, and the prompt cache behind it,
  // stays the same on every request.
  server.setRequestHandler("tools/list", () => ({
    tools: registry.list.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: { ...toJsonSchema(tool), type: "object" as const },
      annotations: tool.annotations,
      _meta: { [strictMetaKey]: tool.strict !== false },
    })),
  }));
  server.setRequestHandler("tools/call", async (request) =>
    toCallToolResult(await callTool(request.params.name, request.params.arguments ?? {})),
  );
  return server;
}
