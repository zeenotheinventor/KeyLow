// A real `mcp` server on a free local port for the MCP client's tests. It serves the same server code as the
// `mcp` function (`createToolServer` behind `createMcpHandler`), records every request, and can fail a
// request on purpose. Nothing in production imports this.
import { createMcpHandler } from "@modelcontextprotocol/server";

import { createToolServer } from "../../mcp/server.ts";
import { createRegistry } from "./registry.ts";
import { fakeReadTool, fakeWriteTool } from "./testing.ts";

import type { CallTool } from "../../mcp/server.ts";
import type { ToolRegistry } from "./tool.ts";

// The JSON-RPC message a request carried, so a test can fail one kind of request.
export type RpcMessage = { id: number | string | null; method: string | null; tool: string | null };

export type RecordedRequest = {
  httpMethod: string;
  url: URL;
  headers: Headers;
  rpc: RpcMessage;
};

export type TestServerOptions = {
  registry?: ToolRegistry;
  callTool?: CallTool;
  // Answers a request without reaching the server, for a status code or a hand-made reply.
  answer?: (request: RecordedRequest) => Response | undefined | Promise<Response | undefined>;
  // True lets the server handle the request, then replaces its reply with a 502, as when the reply is
  // lost after a tool ran.
  dropReply?: (request: RecordedRequest) => boolean;
};

export type TestServer = {
  baseUrl: string;
  requests: RecordedRequest[];
  // The tool names the server ran, in order.
  toolRuns: string[];
  shutdown(): Promise<void>;
};

export const readToolName = "read_one";
export const writeToolName = "write_one";

export function defaultRegistry(): ToolRegistry {
  return createRegistry([
    fakeReadTool(readToolName).definition,
    fakeWriteTool({ name: writeToolName }).definition,
  ]);
}

function rpcOf(text: string): RpcMessage {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return { id: null, method: null, tool: null };
    }
    const id =
      "id" in parsed && (typeof parsed.id === "number" || typeof parsed.id === "string")
        ? parsed.id
        : null;
    const method = "method" in parsed && typeof parsed.method === "string" ? parsed.method : null;
    const params = "params" in parsed ? parsed.params : null;
    const tool =
      typeof params === "object" &&
      params !== null &&
      "name" in params &&
      typeof params.name === "string"
        ? params.name
        : null;
    return { id, method, tool };
  } catch {
    return { id: null, method: null, tool: null };
  }
}

// What a caller sees when the reply is lost after the server did its work: the gateway in front answers 502.
function lostReply(): Response {
  return new Response("Bad Gateway", { status: 502 });
}

export async function startTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const registry = options.registry ?? defaultRegistry();
  const requests: RecordedRequest[] = [];
  const toolRuns: string[] = [];
  const callTool: CallTool =
    options.callTool ??
    ((name) =>
      Promise.resolve({
        status: "ok",
        text: `<untrusted_data tool="${name}">{}</untrusted_data>`,
        structured: { card: "saved" },
        actionId: null,
      }));
  const handler = createMcpHandler(() =>
    createToolServer(registry, (name, rawInput) => {
      toolRuns.push(name);
      return callTool(name, rawInput);
    }),
  );

  async function handle(request: Request): Promise<Response> {
    const text = await request.text();
    const recorded: RecordedRequest = {
      httpMethod: request.method,
      url: new URL(request.url),
      headers: request.headers,
      rpc: rpcOf(text),
    };
    requests.push(recorded);
    const answered = await options.answer?.(recorded);
    if (answered !== undefined) {
      return answered;
    }
    const reply = await handler.fetch(
      new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.method === "POST" ? text : null,
      }),
    );
    return options.dropReply?.(recorded) === true ? lostReply() : reply;
  }

  const listening = Promise.withResolvers<number>();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    handle,
  );
  return {
    baseUrl: `http://127.0.0.1:${await listening.promise}`,
    requests,
    toolRuns,
    shutdown: () => server.shutdown(),
  };
}
