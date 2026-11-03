import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { requireServedFunction } from "../support/functionsLane";
import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The `mcp` function over HTTP, against the served function, called with JSON-RPC as Ki-Lo's own MCP
 * client calls it: the user's JWT, the turn in the URL and the allowed tools in a header. Every user
 * and turn here is created for the suite, and the turns are inserted with the service role.
 *
 * The tool names are not listed here. The function serves every tool in the registry, which gains
 * tools without a change to this function, so the suite checks the three food read tools it calls and
 * what holds for every tool. The registry itself cannot be imported: its `.ts` paths are Deno-style
 * and this package's typecheck cannot follow them. The Deno tests (`mcp/routes.test.ts`) compare the
 * list with the registry.
 */

const minute = 60_000;
const foodTools = ["search_foods", "get_food", "get_recipes"];

type McpResponse = { status: number; body: unknown };

type CallOptions = {
  user?: TestUser;
  // The turn id in the URL. Null leaves the parameter out.
  turn?: string | null;
  allowedTools?: string;
  // The day of the turn's sheet. Null leaves the header out.
  localDate?: string | null;
};

// The stateless transport answers as one server-sent event or as plain JSON.
function parseBody(text: string): unknown {
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  return JSON.parse(data ?? text);
}

async function callMcp(body: unknown, options: CallOptions = {}): Promise<McpResponse> {
  const { apiUrl, anonKey } = inject("stack");
  const url = new URL(`${apiUrl}/functions/v1/mcp`);
  if (options.turn !== null && options.turn !== undefined) {
    url.searchParams.set("turn", options.turn);
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(options.user === undefined
        ? {}
        : { Authorization: `Bearer ${options.user.accessToken}` }),
      ...(options.allowedTools === undefined
        ? {}
        : { "X-Kilo-Allowed-Tools": options.allowedTools }),
      ...(options.localDate === null
        ? {}
        : { "X-Kilo-Local-Date": options.localDate ?? "2026-11-03" }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, body: parseBody(await response.text()) };
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "mcp-http-suite", version: "0" },
  },
};
const listTools = { jsonrpc: "2.0", id: 2, method: "tools/list" };
const callTool = (name: string, args: unknown) => ({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name, arguments: args },
});

type ToolListing = { name: unknown; readOnlyHint: unknown; additionalProperties: unknown };

type ToolCallResult = {
  text: string;
  isError: boolean;
  structuredContent: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function recordAt(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const child = parent[key];
  if (!isRecord(child)) {
    throw new Error(`Expected an object at ${key}`);
  }
  return child;
}

function resultOf(response: McpResponse): Record<string, unknown> {
  expect(response.status).toBe(200);
  if (!isRecord(response.body)) {
    throw new Error("The function answered without a JSON-RPC object");
  }
  return recordAt(response.body, "result");
}

function toolsOf(response: McpResponse): ToolListing[] {
  const { tools } = resultOf(response);
  if (!Array.isArray(tools)) {
    throw new Error("Expected a list of tools");
  }
  return tools.map((tool) => {
    if (!isRecord(tool)) {
      throw new Error("Expected a tool to be an object");
    }
    return {
      name: tool["name"],
      readOnlyHint: recordAt(tool, "annotations")["readOnlyHint"],
      additionalProperties: recordAt(tool, "inputSchema")["additionalProperties"],
    };
  });
}

function toolCallOf(response: McpResponse): ToolCallResult {
  const result = resultOf(response);
  const content = result["content"];
  if (!Array.isArray(content) || content.length !== 1) {
    throw new Error("Expected one content block");
  }
  const first: unknown = content[0];
  if (!isRecord(first) || typeof first["text"] !== "string") {
    throw new Error("Expected a text content block");
  }
  return {
    text: first["text"],
    isError: result["isError"] === true,
    structuredContent: result["structuredContent"],
  };
}

type Fixture = { user: TestUser; foodName: string };

const word = `mcpcheck${crypto.randomUUID().replaceAll("-", "").slice(0, 8).replace(/[0-9]/g, "x")}`;

async function insertTurn(
  user: TestUser,
  options: { status?: string; ageMilliseconds?: number } = {},
): Promise<string> {
  const admin = adminClient();
  const conversation = await admin
    .from("assistant_conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  if (conversation.error) {
    throw new Error("Could not insert a conversation", { cause: conversation.error });
  }
  const turn = await admin
    .from("assistant_turns")
    .insert({
      conversation_id: conversation.data.id,
      user_id: user.id,
      user_message_id: crypto.randomUUID(),
      status: options.status ?? "open",
      ...(options.ageMilliseconds === undefined
        ? {}
        : { created_at: new Date(Date.now() - options.ageMilliseconds).toISOString() }),
    })
    .select("id")
    .single();
  if (turn.error) {
    throw new Error("Could not insert a turn", { cause: turn.error });
  }
  return turn.data.id;
}

async function createFixture(label: string): Promise<Fixture> {
  const user = await createTestUser(`mcp-${label}`);
  const foodName = `${word} ${label} oats`;
  const { error } = await user.client.from("foods").insert({
    source: "user",
    owner_id: user.id,
    name: foodName,
    basis: "per_100g",
    kcal: 372,
    protein_g: 11,
    fat_g: 8,
    carbs_g: 60,
    fibre_g: 9,
    micros: {},
  });
  if (error) {
    throw new Error("Could not insert a food", { cause: error });
  }
  return { user, foodName };
}

let a: Fixture;
let b: Fixture;
let aTurn: string;
let bTurn: string;

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "mcp");
  a = await createFixture("a");
  b = await createFixture("b");
  aTurn = await insertTurn(a.user);
  bTurn = await insertTurn(b.user);
}, 60_000);

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("initialize and tools/list", () => {
  it("initialize answers the server and its tools capability", async () => {
    const response = await callMcp(initialize, { user: a.user, turn: aTurn });

    expect(resultOf(response)).toMatchObject({
      serverInfo: { name: "kilo-assistant-tools" },
      capabilities: { tools: {} },
    });
  });

  it("lists the food read tools in order, every tool with its annotations and a strict schema", async () => {
    await callMcp(initialize, { user: a.user, turn: aTurn });

    const tools = toolsOf(await callMcp(listTools, { user: a.user, turn: aTurn }));

    const names = tools.map((tool) => tool.name);
    expect(names.filter((name) => foodTools.includes(String(name)))).toEqual(foodTools);
    for (const tool of tools) {
      expect(typeof tool.readOnlyHint).toBe("boolean");
      expect(tool.additionalProperties).toBe(false);
    }
    for (const tool of tools.filter((listed) => foodTools.includes(String(listed.name)))) {
      expect(tool.readOnlyHint).toBe(true);
    }
  });

  it("lists the same tools whichever tools the turn may call", async () => {
    const names = async (allowedTools?: string) => {
      const tools = toolsOf(
        await callMcp(listTools, {
          user: a.user,
          turn: aTurn,
          ...(allowedTools === undefined ? {} : { allowedTools }),
        }),
      );
      return tools.map((tool) => tool.name);
    };

    const everyTool = await names();

    expect(await names("get_food")).toEqual(everyTool);
    expect(await names("")).toEqual(everyTool);
  });
});

describe("tools/call", () => {
  it("search_foods answers results wrapped as untrusted data, and the outcome as structuredContent", async () => {
    const result = toolCallOf(
      await callMcp(callTool("search_foods", { q: word, limit: 5 }), {
        user: a.user,
        turn: aTurn,
        allowedTools: "search_foods,get_food,get_recipes",
      }),
    );

    expect(result.isError).toBe(false);
    const { text } = result;
    expect(text).toContain("<untrusted_data");
    expect(text).toContain(a.foodName);
    expect(text).not.toContain(a.user.id);
    expect(text).not.toContain(b.foodName);
    // The outcome holds no row. This tool has no card or citation, so `structured` is null.
    expect(result.structuredContent).toEqual({ status: "ok", structured: null, actionId: null });
  });

  it("answers the executor's invalid_input for a bad argument, not a server error", async () => {
    const response = await callMcp(callTool("search_foods", { q: 42 }), {
      user: a.user,
      turn: aTurn,
      allowedTools: "search_foods",
    });

    const result = toolCallOf(response);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ status: "error", code: "invalid_input" });
  });

  it("answers tool_not_allowed for a tool outside the header, and for every tool without it", async () => {
    for (const allowedTools of ["get_food", undefined]) {
      const result = toolCallOf(
        await callMcp(callTool("search_foods", { q: word }), {
          user: a.user,
          turn: aTurn,
          ...(allowedTools === undefined ? {} : { allowedTools }),
        }),
      );

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({ status: "error", code: "tool_not_allowed" });
      expect(result.text).not.toContain(a.foodName);
    }
  });
});

describe("who may call", () => {
  it("answers 401 to a call with no sign-in", async () => {
    const response = await callMcp(listTools, { turn: aTurn });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("answers 400 to a call with no turn", async () => {
    const response = await callMcp(listTools, { user: a.user });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("answers 400 to a call with no local date", async () => {
    const response = await callMcp(listTools, { user: a.user, turn: aTurn, localDate: null });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("answers 400 to a turn that is not an id", async () => {
    const response = await callMcp(listTools, { user: a.user, turn: "not-a-turn" });

    expect(response.status).toBe(400);
  });

  it("answers 401 to the user's JWT with another user's open turn, and runs nothing", async () => {
    const response = await callMcp(callTool("search_foods", { q: word }), {
      user: a.user,
      turn: bTurn,
      allowedTools: "search_foods",
    });

    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain(b.foodName);
  });

  it("answers 401 to a turn that does not exist", async () => {
    const response = await callMcp(listTools, { user: a.user, turn: crypto.randomUUID() });

    expect(response.status).toBe(401);
  });

  it.each(["complete", "clarify", "confirm", "stopped", "failed", "refused"])(
    "answers 401 to a %s turn",
    async (status) => {
      const closed = await insertTurn(a.user, { status });

      const response = await callMcp(listTools, { user: a.user, turn: closed });

      expect(response.status).toBe(401);
    },
  );

  it("answers 401 to a turn created over 5 minutes ago", async () => {
    const old = await insertTurn(a.user, { ageMilliseconds: 6 * minute });

    const response = await callMcp(listTools, { user: a.user, turn: old });

    expect(response.status).toBe(401);
  });

  it("serves a turn created a minute ago", async () => {
    const recent = await insertTurn(a.user, { ageMilliseconds: minute });

    const response = await callMcp(listTools, { user: a.user, turn: recent });

    expect(response.status).toBe(200);
  });
});
