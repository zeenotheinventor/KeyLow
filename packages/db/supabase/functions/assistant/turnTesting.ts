// Stand-ins for the turn loop's tests: a Messages API mock that streams scripted replies from a local
// port (the loop's Anthropic client points at it through its base URL), a fake MCP connection that
// counts every call, and a harness that runs turns over the turn store's fake client. Nothing in
// production imports this.
import { McpClientError } from "../_shared/assistant/mcpClient.ts";
import { wrapUntrusted } from "../_shared/assistant/untrusted.ts";
import { createEventStream } from "./sse.ts";
import { createModelClient, createRunTurn, createToolListCache } from "./turn.ts";
import { createTurnStore } from "./turnStore.ts";
import { fakeSupabase } from "./testing.ts";
import { recordUsage } from "./usage.ts";

import type { ListedTool, ToolCallResult, ToolConnection } from "../_shared/assistant/mcpClient.ts";
import type { AssistantStoredMessage, AssistantStreamEvent } from "../_shared/core.ts";
import type { AllowlistTool } from "./allowlist.ts";
import type { KitchenEntry } from "./kitchen.ts";
import type { TurnContext } from "./runTurn.ts";
import type { TurnDependencies, TurnLimits } from "./turn.ts";
import type { TurnStore } from "./turnStore.ts";

export const userId = "00000000-0000-4000-8000-0000000000a1";
export const userEmail = "someone.private@example.com";
export const jwt = "jwt-sentinel-5531";

// ---- The Messages API mock ----

export type ScriptedBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "redacted_thinking"; data: string }
  // `rawJson` is streamed as the input instead of `input`, for an input the model got wrong.
  | { type: "tool_use"; id: string; name: string; input?: unknown; rawJson?: string };

export type ScriptedResponse = {
  blocks: ScriptedBlock[];
  stopReason: "end_turn" | "tool_use" | "refusal" | "max_tokens" | "pause_turn";
  usage?: { input?: number; output?: number; cacheRead?: number; cacheCreation?: number };
  // Streams up to the first text delta, then keeps the stream open until the reader goes away.
  holdAfterFirstText?: boolean;
  // Sends the headers and then no event at all, until the reader goes away.
  holdAfterHeaders?: boolean;
  // Never answers, not even with headers, until the reader goes away.
  neverAnswer?: boolean;
  // An error reply instead of a stream.
  httpStatus?: number;
  // Ends the stream after its blocks, with no message_delta or message_stop.
  endWithoutStop?: boolean;
};

export type ModelMock = {
  baseUrl: string;
  // The body of every request, as text and as JSON.
  bodies: string[];
  // The `anthropic-beta` header of every request, or null when it had none.
  betaHeaders: (string | null)[];
  json: () => Record<string, unknown>[];
  firstTextSent: Promise<void>;
  shutdown(): Promise<void>;
};

const sse = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

function chunksOf(text: string): string[] {
  return text.split(/(?<= )/).filter((chunk) => chunk !== "");
}

function eventsOf(response: ScriptedResponse, index: number): { head: string[]; tail: string[] } {
  const usage = response.usage ?? {};
  const events = [
    sse("message_start", {
      type: "message_start",
      message: {
        id: `msg_${index}`,
        type: "message",
        role: "assistant",
        model: "claude-haiku-5-5-20260301",
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: usage.input ?? 100,
          output_tokens: 1,
          cache_read_input_tokens: usage.cacheRead ?? 0,
          cache_creation_input_tokens: usage.cacheCreation ?? 0,
        },
      },
    }),
  ];
  let firstTextDelta = -1;
  response.blocks.forEach((block, blockIndex) => {
    const start =
      block.type === "text"
        ? { type: "text", text: "" }
        : block.type === "thinking"
          ? { type: "thinking", thinking: "", signature: "" }
          : block.type === "redacted_thinking"
            ? { type: "redacted_thinking", data: block.data }
            : { type: "tool_use", id: block.id, name: block.name, input: {} };
    events.push(
      sse("content_block_start", {
        type: "content_block_start",
        index: blockIndex,
        content_block: start,
      }),
    );
    const delta = (body: unknown) =>
      sse("content_block_delta", { type: "content_block_delta", index: blockIndex, delta: body });
    if (block.type === "text") {
      for (const chunk of chunksOf(block.text)) {
        events.push(delta({ type: "text_delta", text: chunk }));
        if (firstTextDelta < 0) {
          firstTextDelta = events.length - 1;
        }
      }
    } else if (block.type === "thinking") {
      events.push(
        delta({ type: "thinking_delta", thinking: block.thinking }),
        delta({ type: "signature_delta", signature: block.signature }),
      );
    } else if (block.type === "tool_use") {
      const json = block.rawJson ?? JSON.stringify(block.input ?? {});
      const middle = Math.floor(json.length / 2);
      events.push(
        delta({ type: "input_json_delta", partial_json: json.slice(0, middle) }),
        delta({ type: "input_json_delta", partial_json: json.slice(middle) }),
      );
    }
    events.push(sse("content_block_stop", { type: "content_block_stop", index: blockIndex }));
  });
  events.push(
    sse("message_delta", {
      type: "message_delta",
      delta: { stop_reason: response.stopReason, stop_sequence: null },
      usage: { output_tokens: usage.output ?? 20 },
    }),
    sse("message_stop", { type: "message_stop" }),
  );
  if (response.endWithoutStop === true) {
    return { head: events.slice(0, -2), tail: [] };
  }
  if (response.holdAfterFirstText !== true) {
    return { head: events, tail: [] };
  }
  return { head: events.slice(0, firstTextDelta + 1), tail: events.slice(firstTextDelta + 1) };
}

// A reply to a request that did not ask for a stream, as the Messages API answers one (the compaction call).
function messageOf(response: ScriptedResponse, index: number) {
  const usage = response.usage ?? {};
  return {
    id: `msg_${index}`,
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5-20260301",
    content: response.blocks.map((block) =>
      block.type === "tool_use"
        ? { type: "tool_use", id: block.id, name: block.name, input: block.input ?? {} }
        : block,
    ),
    stop_reason: response.stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: usage.input ?? 100,
      output_tokens: usage.output ?? 20,
      cache_read_input_tokens: usage.cacheRead ?? 0,
      cache_creation_input_tokens: usage.cacheCreation ?? 0,
    },
  };
}

export async function startModelMock(responses: ScriptedResponse[]): Promise<ModelMock> {
  const bodies: string[] = [];
  const betaHeaders: (string | null)[] = [];
  const encoder = new TextEncoder();
  const listening = Promise.withResolvers<number>();
  const firstText = Promise.withResolvers<void>();
  const stopped = Promise.withResolvers<void>();
  let next = 0;

  const failure = (status: number) =>
    Response.json(
      { type: "error", error: { type: "invalid_request_error", message: "x" } },
      { status },
    );

  async function handle(request: Request): Promise<Response> {
    const body = await request.text();
    bodies.push(body);
    betaHeaders.push(request.headers.get("anthropic-beta"));
    const index = next;
    next += 1;
    const scripted = responses[index];
    if (scripted === undefined) {
      return failure(400);
    }
    if (scripted.neverAnswer === true) {
      const readerGone = Promise.withResolvers<void>();
      request.signal.addEventListener("abort", () => readerGone.resolve());
      await Promise.race([readerGone.promise, stopped.promise]);
      return failure(499);
    }
    if (scripted.httpStatus !== undefined) {
      return failure(scripted.httpStatus);
    }
    if (JSON.parse(body).stream !== true) {
      return Response.json(messageOf(scripted, index));
    }
    const { head } = eventsOf(scripted, index);
    const cancelled = Promise.withResolvers<void>();
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          if (scripted.holdAfterHeaders === true) {
            await Promise.race([cancelled.promise, stopped.promise]);
            return;
          }
          for (const event of head) {
            controller.enqueue(encoder.encode(event));
          }
          if (scripted.holdAfterFirstText === true) {
            // The rest of the reply is never sent, as when the connection stalls.
            firstText.resolve();
            await Promise.race([cancelled.promise, stopped.promise]);
            return;
          }
          controller.close();
        },
        cancel() {
          cancelled.resolve();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    handle,
  );
  return {
    baseUrl: `http://127.0.0.1:${await listening.promise}`,
    bodies,
    betaHeaders,
    json: () => bodies.map((body) => JSON.parse(body)),
    firstTextSent: firstText.promise,
    async shutdown() {
      stopped.resolve();
      await server.shutdown();
    },
  };
}

// ---- The fake MCP connection ----

export type ToolAnswer =
  ToolCallResult | ((input: Record<string, unknown>) => ToolCallResult | Promise<ToolCallResult>);

export type FakeConnection = ToolConnection & {
  calls: { name: string; input: Record<string, unknown> }[];
  // listTools, callTool and close, in the order they happened.
  log: string[];
  closeCount: number;
};

export function okResult(
  options: {
    name?: string;
    payload?: unknown;
    structured?: unknown;
    actionId?: string | null;
  } = {},
): ToolCallResult {
  const { name = "tool", payload = {}, structured = null, actionId = null } = options;
  return {
    text: wrapUntrusted(name, JSON.parse(JSON.stringify(payload))),
    isError: false,
    outcome: { status: "ok", structured: JSON.parse(JSON.stringify(structured)), actionId },
  };
}

export function errorResult(name: string, code: string): ToolCallResult {
  return {
    text: wrapUntrusted(name, { error: code }),
    isError: true,
    outcome: { status: "error", code },
  };
}

// The question is for the turn loop only, so it is in the outcome and never in the text the model reads.
export function confirmationResult(
  name: string,
  confirmationId: string,
  { question, note, asksAgain }: { question?: string; note?: string; asksAgain?: true } = {},
): ToolCallResult {
  return {
    text: wrapUntrusted(name, {
      status: "needs_confirmation",
      confirmation_id: confirmationId,
      ...(asksAgain === undefined ? {} : { asked_again: true }),
      ...(note === undefined ? {} : { note }),
    }),
    isError: false,
    outcome: {
      status: "needs_confirmation",
      confirmationId,
      ...(question === undefined ? {} : { question }),
      ...(note === undefined ? {} : { note }),
      ...(asksAgain === undefined ? {} : { asksAgain }),
    },
  };
}

export function fakeConnection(
  tools: ListedTool[],
  answers: Record<string, ToolAnswer>,
): FakeConnection {
  const calls: FakeConnection["calls"] = [];
  const log: string[] = [];
  const connection: FakeConnection = {
    calls,
    log,
    closeCount: 0,
    listTools() {
      log.push("listTools");
      return Promise.resolve(tools);
    },
    async callTool(name, input) {
      log.push(`callTool:${name}`);
      calls.push({ name, input });
      const answer = answers[name];
      if (answer === undefined) {
        return okResult({ name });
      }
      return typeof answer === "function" ? await answer(input) : answer;
    },
    close() {
      log.push("close");
      connection.closeCount += 1;
      return Promise.resolve();
    },
  };
  return connection;
}

export const failingCall = (): ToolAnswer => () => {
  throw new McpClientError("mcp_unreachable");
};

// ---- Listed tools ----

const closed = { type: "object", additionalProperties: false } as const;

export const listed = (
  name: string,
  readOnlyHint: boolean,
  properties: Record<string, unknown> = {},
  strict = true,
): ListedTool => ({
  name,
  description: `The ${name} tool.`,
  inputSchema: { ...closed, properties, required: Object.keys(properties) },
  readOnlyHint,
  strict,
});

export const fakeTools: ListedTool[] = [
  listed("search_foods", true, { query: { type: "string" } }),
  listed("get_day", true, { local_date: { type: "string" } }),
  listed("get_entries", true, { local_date: { type: "string" } }),
  listed("log_entry", false, { food_id: { type: "string" } }, false),
  listed("delete_entry", false, { ids: { type: "array", items: { type: "string" } } }),
  listed("ask_user", true, {
    question: { type: "string" },
    quick_replies: { type: "array", items: { type: "string" } },
  }),
  listed("import_recipe_from_url", false, { url: { type: "string" } }),
  listed("update_targets", false, { current_kcal: { type: "number" } }),
];

// A tool of the hidden kitchen group (ADR 0006, Amendment 5).
export const listedKitchen = (
  name: string,
  readOnlyHint: boolean,
  properties: Record<string, unknown> = {},
): ListedTool => ({ ...listed(name, readOnlyHint, properties, false), group: "kitchen" });

export const allowlistToolsOf = (tools: readonly ListedTool[]): AllowlistTool[] =>
  tools.map(({ name, readOnlyHint, group }) => ({
    name,
    readOnlyHint,
    ...(group === undefined ? {} : { group }),
  }));

// ---- The harness ----

// A stored row with the status of its turn. The role is `system` for the stored kitchen addition.
export type HarnessRow = AssistantStoredMessage;

export type TurnResult = {
  events: AssistantStreamEvent[];
  turnId: string;
  // The messages of the conversation, in order, with the status of their turn. The stored kitchen addition is
  // not among them: it is not something the app draws.
  rows: AssistantStoredMessage[];
};

export type Harness = {
  conversationId: string;
  // The turn store itself, before `wrapTurns`.
  turns: TurnStore;
  mock: ModelMock;
  connections: FakeConnection[];
  connectOptions: Parameters<TurnDependencies["connect"]>[0][];
  reports: { code: string; caught: unknown }[];
  // Everything written to the streams so far, as the app would have read it.
  written: string[];
  usageRows: () => Record<string, unknown>[];
  turnRows: () => Record<string, unknown>[];
  rows: () => AssistantStoredMessage[];
  // Every stored row, the kitchen addition included.
  storedRows: () => HarnessRow[];
  conversationRows: () => Record<string, unknown>[];
  // Waits for the work a turn handed to `runInBackground`, which is the compaction.
  finishBackground(): Promise<void>;
  start(
    text: string,
    options?: { request?: Request; localTime?: string | null; entry?: KitchenEntry },
  ): { cancel(): Promise<void>; textReceived: Promise<void>; finished: Promise<TurnResult> };
  take(
    text: string,
    options?: { localTime?: string | null; entry?: KitchenEntry },
  ): Promise<TurnResult>;
  shutdown(): Promise<void>;
};

export type HarnessOptions = {
  responses: ScriptedResponse[];
  tools?: ListedTool[];
  answers?: Record<string, ToolAnswer>;
  apiKey?: string | null;
  now?: Date;
  wrapTurns?: (turns: TurnStore) => TurnStore;
  // Makes every usage insert fail.
  failUsage?: boolean;
  // Short limits, in milliseconds, so a test never waits for real minutes.
  limits?: TurnLimits;
  // The turn store's clock, for a test that needs `updated_at` to move by a known step.
  storeNow?: () => Date;
  // `ASSISTANT_KITCHEN`. Off unless set.
  kitchen?: boolean;
};

export async function createHarness(options: HarnessOptions): Promise<Harness> {
  const tools = options.tools ?? fakeTools;
  const mock = await startModelMock(options.responses);
  const database = fakeSupabase({
    tables: {
      profiles: [
        {
          id: userId,
          timezone: "Europe/London",
          email: userEmail,
          sex: "female",
          birth_date: "1990-04-12",
          height_cm: 173.4,
        },
      ],
    },
  });
  const turns = createTurnStore(
    database.client,
    options.storeNow === undefined ? {} : { now: options.storeNow },
  );
  const conversationId = await turns.createConversation(userId);
  const connections: FakeConnection[] = [];
  const connectOptions: Harness["connectOptions"] = [];
  const reports: Harness["reports"] = [];
  const apiKey = options.apiKey === undefined ? "sk-test-key" : options.apiKey;
  const environment: Record<string, string> =
    apiKey === null
      ? { ANTHROPIC_BASE_URL: mock.baseUrl }
      : { ANTHROPIC_API_KEY: apiKey, ANTHROPIC_BASE_URL: mock.baseUrl };

  const written: string[] = [];
  const background: Promise<unknown>[] = [];
  const dependencies: TurnDependencies = {
    turns: options.wrapTurns?.(turns) ?? turns,
    toolListCache: createToolListCache(),
    recordUsage: (call) =>
      options.failUsage === true
        ? Promise.reject(new Error("the usage insert failed"))
        : recordUsage(database.client, call),
    connect(connectionOptions) {
      connectOptions.push(connectionOptions);
      const connection = fakeConnection(tools, options.answers ?? {});
      connections.push(connection);
      return Promise.resolve(connection);
    },
    runInBackground: (task) => {
      background.push(task);
    },
    createModelClient: () => createModelClient((name) => environment[name]),
    availableTools: allowlistToolsOf(tools),
    kitchenEnabled: () => options.kitchen === true,
    functionsBaseUrl: () => "http://127.0.0.1:54321",
    report: (_functionName, code, caught) => {
      reports.push({ code, caught });
    },
    now: () => options.now ?? new Date("2026-11-03T12:00:00.000Z"),
  };
  const runTurn = createRunTurn(dependencies, options.limits);

  const storedRows = (): HarnessRow[] => {
    const statusOf = new Map(
      (database.tables["assistant_turns"] ?? []).map((turn) => [turn["id"], turn["status"]]),
    );
    return [...(database.tables["assistant_messages"] ?? [])]
      .sort((left, right) => Number(left["seq"]) - Number(right["seq"]))
      .map((row): HarnessRow => {
        const status = statusOf.get(row["turn_id"]);
        return {
          id: String(row["id"]),
          turnId: String(row["turn_id"]),
          role: row["role"] === "assistant" || row["role"] === "system" ? row["role"] : "user",
          content: row["content"],
          display: row["display"],
          turnStatus: status === "open" || status === undefined ? "open" : toStatus(status),
        };
      });
  };

  const rows = (): AssistantStoredMessage[] => storedRows().filter((row) => row.role !== "system");

  function start(
    text: string,
    startOptions: { request?: Request; localTime?: string | null; entry?: KitchenEntry } = {},
  ) {
    const textReceived = Promise.withResolvers<void>();
    const prepared = turns.startTurn({ userId, conversationId, text }).then((started) => {
      const { stream, body } = createEventStream();
      const reader = body.getReader();
      const chunks: string[] = [];
      const reading = pump(reader, chunks, (chunk) => {
        written.push(chunk);
        if (chunk.includes('"type":"text"')) {
          textReceived.resolve();
        }
      });
      const context: TurnContext = {
        userId,
        conversationId,
        turnId: started.turnId,
        userMessageId: started.userMessageId,
        text,
        localDate: "2026-11-03",
        localTime: startOptions.localTime ?? null,
        ...(startOptions.entry === undefined ? {} : { entry: startOptions.entry }),
        request:
          startOptions.request ??
          new Request("http://localhost/functions/v1/assistant/turn", {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
          }),
      };
      return { stream, reader, chunks, reading, context };
    });
    const finished = prepared.then(async ({ stream, chunks, reading, context }) => {
      await runTurn(context, stream);
      stream.close();
      await reading;
      return {
        events: chunks
          .join("")
          .split("\n\n")
          .filter((block) => block !== "")
          .map((block) => JSON.parse(block.replace(/^data: /, ""))),
        turnId: context.turnId,
        rows: rows(),
      };
    });
    return {
      // The app closes the sheet: the reader of the stream goes away.
      async cancel() {
        await (await prepared).reader.cancel();
      },
      textReceived: textReceived.promise,
      finished,
    };
  }

  return {
    conversationId,
    turns,
    mock,
    connections,
    connectOptions,
    reports,
    written,
    usageRows: () => database.tables["assistant_usage"] ?? [],
    turnRows: () => database.tables["assistant_turns"] ?? [],
    rows,
    storedRows,
    conversationRows: () => database.tables["assistant_conversations"] ?? [],
    async finishBackground() {
      await Promise.all(background.splice(0));
    },
    start,
    take: (text, takeOptions) => start(text, takeOptions).finished,
    shutdown: () => mock.shutdown(),
  };
}

async function pump(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: string[],
  onChunk: (chunk: string) => void,
) {
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      const chunk = decoder.decode(value);
      chunks.push(chunk);
      onChunk(chunk);
    }
  } catch {
    // A cancelled stream ends the reading.
  }
}

function toStatus(value: unknown): AssistantStoredMessage["turnStatus"] {
  switch (value) {
    case "complete":
    case "clarify":
    case "confirm":
    case "stopped":
    case "failed":
    case "refused":
      return value;
    default:
      return "open";
  }
}
