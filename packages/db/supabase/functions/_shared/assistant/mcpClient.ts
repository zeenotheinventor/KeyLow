// The assistant's MCP client: the `assistant` function is the MCP host, and this is its connection to Ki-Lo's
// own `mcp` function over Streamable HTTP. It lists the tools and runs a call, and it knows no model API
// (`adapters/` turns the tools into one model's shape). The user's JWT goes to the `mcp` function in the
// `Authorization` header and nowhere else, and the URL holds only the turn id. A failure never repeats a
// write: a retry is allowed only when no tool could have run (`mayRetry`). A log line holds the turn,
// the tool, a code and the duration, never the token, an argument or a result.
import {
  Client,
  DEFAULT_REQUEST_TIMEOUT_MSEC,
  ProtocolError,
  SdkError,
  SdkErrorCode,
  SdkHttpError,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { z } from "zod";

import { strictMetaKey } from "./tool.ts";

import type { JsonSchemaObject } from "./tool.ts";

const functionPath = "/functions/v1/mcp";
const clientInfo = { name: "kilo-assistant", version: "1.0.0" };

export type McpClientErrorCode =
  "mcp_unauthorised" | "mcp_bad_request" | "mcp_unreachable" | "mcp_protocol";

// The message is fixed per code. The server's reply can quote a row, so it is never copied into an error.
const errorMessages: Record<McpClientErrorCode, string> = {
  mcp_unauthorised: "The MCP server refused the sign-in or the turn",
  mcp_bad_request: "The MCP server could not read the request",
  mcp_unreachable: "The MCP server could not be reached",
  mcp_protocol: "The MCP server answered something the client cannot use",
};

export class McpClientError extends Error {
  readonly code: McpClientErrorCode;

  constructor(code: McpClientErrorCode) {
    super(errorMessages[code]);
    this.name = "McpClientError";
    this.code = code;
  }
}

export type ListedTool = {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
  // A tool that does not say it only reads is treated as a write.
  readOnlyHint: boolean;
  // Whether the model's API should hold the tool to its schema. A tool that does not say it opted out.
  strict: boolean;
};

// The executor's outcome, which `mcp` returns as `structuredContent`. Only the turn loop reads it.
const outcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), structured: z.json(), actionId: z.string().nullable() }),
  z.object({ status: z.literal("needs_confirmation"), confirmationId: z.string() }),
  z.object({ status: z.literal("error"), code: z.string() }),
]);

export type ToolOutcome = z.infer<typeof outcomeSchema>;

export type ToolCallResult = {
  // The executor's wrapped result, which is all the model reads.
  text: string;
  isError: boolean;
  outcome: ToolOutcome;
};

export type TurnHasAction = (turnId: string) => Promise<boolean>;

export type ConnectToolServerOptions = {
  // The project's own SUPABASE_URL.
  functionsBaseUrl: string;
  turnId: string;
  // The caller's JWT as received.
  accessToken: string;
  allowedTools: readonly string[];
  // The day the turn's sheet was opened on, and the hour when it knows one. A write defaults to them.
  localDate: string;
  localTime: string | null;
  // Whether the turn has an `assistant_actions` row, read with the service client by the caller.
  turnHasAction: TurnHasAction;
  requestTimeoutMilliseconds?: number;
  // A list the caller already holds. The connection then knows which tools only read, for the retry rule,
  // without a `tools/list` round trip of its own.
  knownTools?: readonly ListedTool[];
};

export type ToolConnection = {
  listTools(): Promise<ListedTool[]>;
  callTool(name: string, input: Record<string, unknown>): Promise<ToolCallResult>;
  close(): Promise<void>;
};

export type RetryStep = "connect" | "list_tools" | "call_tool";

export type RetryFailure = {
  turnId: string;
  step: RetryStep;
  // The tool of a `call_tool` step, or undefined when the list did not name it.
  tool?: Pick<ListedTool, "readOnlyHint"> | undefined;
  // How many attempts have failed so far, this one included.
  attempt: number;
  error: McpClientError;
};

// Retry only when no tool could have run, and only once. A connect, initialise or list failure ran nothing.
// A read call may run twice, but not after the turn has an action row. A write call may have run before the
// reply was lost, so it never repeats, with or without a row. A refused sign-in or request would fail again.
export async function mayRetry(
  failure: RetryFailure,
  turnHasAction: TurnHasAction,
): Promise<boolean> {
  const { error, step, tool } = failure;
  if (
    failure.attempt > 1 ||
    error.code === "mcp_unauthorised" ||
    error.code === "mcp_bad_request"
  ) {
    return false;
  }
  if (step !== "call_tool") {
    return true;
  }
  if (tool?.readOnlyHint !== true) {
    return false;
  }
  try {
    return !(await turnHasAction(failure.turnId));
  } catch {
    // Not knowing whether a row exists is not a reason to run a second time.
    return false;
  }
}

const unreachableSdkCodes: ReadonlySet<string> = new Set([
  SdkErrorCode.RequestTimeout,
  SdkErrorCode.ConnectionClosed,
  SdkErrorCode.SendFailed,
]);

function codeForStatus(status: number): McpClientErrorCode {
  if (status === 401) {
    return "mcp_unauthorised";
  }
  if (status === 400) {
    return "mcp_bad_request";
  }
  return status >= 500 ? "mcp_unreachable" : "mcp_protocol";
}

function toClientError(caught: unknown): McpClientError {
  if (caught instanceof McpClientError) {
    return caught;
  }
  if (caught instanceof SdkHttpError) {
    return new McpClientError(codeForStatus(caught.status));
  }
  if (caught instanceof SdkError) {
    return new McpClientError(
      unreachableSdkCodes.has(caught.code) ? "mcp_unreachable" : "mcp_protocol",
    );
  }
  if (caught instanceof ProtocolError) {
    return new McpClientError("mcp_protocol");
  }
  return new McpClientError(caught instanceof TypeError ? "mcp_unreachable" : "mcp_protocol");
}

function endpointOf(options: ConnectToolServerOptions): URL {
  const url = new URL(`${options.functionsBaseUrl.replace(/\/+$/, "")}${functionPath}`);
  url.searchParams.set("turn", options.turnId);
  return url;
}

async function openClient(options: ConnectToolServerOptions): Promise<Client> {
  const client = new Client(clientInfo);
  const transport = new StreamableHTTPClientTransport(endpointOf(options), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        "X-Kilo-Allowed-Tools": options.allowedTools.join(","),
        "X-Kilo-Local-Date": options.localDate,
        ...(options.localTime === null ? {} : { "X-Kilo-Local-Time": options.localTime }),
      },
    },
  });
  try {
    await client.connect(transport, {
      timeout: options.requestTimeoutMilliseconds ?? DEFAULT_REQUEST_TIMEOUT_MSEC,
    });
  } catch (caught) {
    await client.close().catch(() => {});
    throw toClientError(caught);
  }
  return client;
}

function log(turnId: string, step: RetryStep, tool: string, code: string, startedAt: number): void {
  const milliseconds = Math.round(performance.now() - startedAt);
  console.log(`mcp client turn=${turnId} step=${step} tool=${tool} code=${code} ${milliseconds}ms`);
}

type Step<Value> = {
  step: RetryStep;
  // A name the list gave, "unknown" for one it did not, "none" outside a call. The model chose the name
  // of a call, so an unlisted one is not copied into the log.
  toolLabel: string;
  tool?: Pick<ListedTool, "readOnlyHint"> | undefined;
  codeOf?: (value: Value) => string;
  run: () => Promise<Value>;
};

async function runStep<Value>(
  options: ConnectToolServerOptions,
  { step, toolLabel, tool, codeOf, run }: Step<Value>,
): Promise<Value> {
  for (let attempt = 1; ; attempt++) {
    const startedAt = performance.now();
    try {
      const value = await run();
      log(options.turnId, step, toolLabel, codeOf?.(value) ?? "ok", startedAt);
      return value;
    } catch (caught) {
      const error = toClientError(caught);
      log(options.turnId, step, toolLabel, error.code, startedAt);
      const retry = await mayRetry(
        { turnId: options.turnId, step, tool, attempt, error },
        options.turnHasAction,
      );
      if (!retry) {
        throw error;
      }
    }
  }
}

function outcomeCode(result: ToolCallResult): string {
  return result.outcome.status === "error" ? result.outcome.code : result.outcome.status;
}

// Connects and runs the MCP handshake. The returned connection is for one turn, and `close()` ends it.
export async function connectToolServer(
  options: ConnectToolServerOptions,
): Promise<ToolConnection> {
  const client = await runStep(options, {
    step: "connect",
    toolLabel: "none",
    run: () => openClient(options),
  });
  const timeout = options.requestTimeoutMilliseconds ?? DEFAULT_REQUEST_TIMEOUT_MSEC;
  // What the last list said, to tell a read from a write when a call fails. The list itself is fetched
  // again on every call to `listTools` and the SDK's own cache is bypassed. On the served local stack the
  // round trip measured 0.2 s at the median (KEY-795), because every request to `mcp` pays the JWT check
  // and a turn lookup, so the turn loop keeps the list between turns and hands it in as `knownTools`.
  const listed = new Map<string, ListedTool>(
    (options.knownTools ?? []).map((tool) => [tool.name, tool]),
  );

  return {
    listTools: () =>
      runStep(options, {
        step: "list_tools",
        toolLabel: "none",
        async run() {
          const { tools } = await client.listTools(undefined, { timeout, cacheMode: "bypass" });
          return tools.map((tool) => ({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema,
            readOnlyHint: tool.annotations?.readOnlyHint === true,
            strict: tool._meta?.[strictMetaKey] !== false,
          }));
        },
      }).then((tools) => {
        listed.clear();
        for (const tool of tools) {
          listed.set(tool.name, tool);
        }
        return tools;
      }),

    callTool(name, input) {
      const tool = listed.get(name);
      return runStep(options, {
        step: "call_tool",
        toolLabel: tool === undefined ? "unknown" : tool.name,
        tool,
        codeOf: outcomeCode,
        async run() {
          const result = await client.callTool({ name, arguments: input }, { timeout });
          const outcome = outcomeSchema.safeParse(result.structuredContent);
          if (!outcome.success) {
            throw new McpClientError("mcp_protocol");
          }
          return {
            text: result.content
              .flatMap((block) => (block.type === "text" ? [block.text] : []))
              .join("\n"),
            isError: result.isError === true,
            outcome: outcome.data,
          };
        },
      });
    },

    async close() {
      try {
        await client.close();
      } catch (caught) {
        log(options.turnId, "call_tool", "none", toClientError(caught).code, performance.now());
      }
    },
  };
}
