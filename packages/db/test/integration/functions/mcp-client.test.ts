import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { requireServedFunction } from "../support/functionsLane";
import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The `mcp` function as the assistant's MCP client calls it: the user's JWT in `Authorization`, the turn
 * id as the only URL parameter and the turn's tools in `X-Kilo-Allowed-Tools`, walking the client's
 * sequence (initialize, initialized, tools/list, tools/call). The client module itself
 * (`_shared/assistant/mcpClient.ts`) imports Deno-style `.ts` paths that this package's typecheck cannot
 * follow, and the SDK client is not a dependency of this package, so this suite speaks the same wire
 * with `fetch`, as `mcp.test.ts` does. The client's own error mapping (a 401 is `mcp_unauthorised` and
 * is not retried) is proved in the Deno tests, against the real `createMcpEndpoint` handler. Every user
 * and turn here is created for the suite, and the turns are inserted with the service role.
 */

type Reply = { status: number; body: unknown };

const allowedTools = "search_foods,get_food,get_recipes";

// The stateless transport answers as one server-sent event or as plain JSON.
function parseBody(text: string): unknown {
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  return text === "" ? null : JSON.parse(data ?? text);
}

async function send(user: TestUser, turn: string, message: unknown): Promise<Reply> {
  const url = new URL(`${inject("stack").apiUrl}/functions/v1/mcp`);
  url.searchParams.set("turn", turn);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      "X-Kilo-Allowed-Tools": allowedTools,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(message),
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
    clientInfo: { name: "kilo-assistant", version: "1.0.0" },
  },
};
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
const listTools = { jsonrpc: "2.0", id: 2, method: "tools/list" };
const searchFoods = {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "search_foods", arguments: { q: "oats", limit: 5 } },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function resultOf(reply: Reply): Record<string, unknown> {
  expect(reply.status).toBe(200);
  if (!isRecord(reply.body) || !isRecord(reply.body["result"])) {
    throw new Error("Expected a JSON-RPC result");
  }
  return reply.body["result"];
}

async function insertOpenTurn(user: TestUser): Promise<string> {
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
      status: "open",
    })
    .select("id")
    .single();
  if (turn.error) {
    throw new Error("Could not insert a turn", { cause: turn.error });
  }
  return turn.data.id;
}

let userA: TestUser;
let userB: TestUser;
let turnOfA: string;
let turnOfB: string;

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "mcp");
  userA = await createTestUser("mcp-client-a");
  userB = await createTestUser("mcp-client-b");
  turnOfA = await insertOpenTurn(userA);
  turnOfB = await insertOpenTurn(userB);
}, 60_000);

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("the assistant's MCP client against the served mcp function", () => {
  it("lists the tools and calls search_foods with the user's JWT and the user's open turn", async () => {
    expect((await send(userA, turnOfA, initialize)).status).toBe(200);
    await send(userA, turnOfA, initialized);

    const { tools } = resultOf(await send(userA, turnOfA, listTools));
    expect(Array.isArray(tools) ? tools.length : 0).toBeGreaterThan(0);

    const result = resultOf(await send(userA, turnOfA, searchFoods));
    const content = result["content"];
    const first: unknown = Array.isArray(content) ? content[0] : undefined;
    expect(isRecord(first) ? first["text"] : null).toEqual(
      expect.stringContaining("<untrusted_data"),
    );
    expect(result["structuredContent"]).toMatchObject({ status: "ok" });
  });

  it("answers 401 to the user's JWT with another user's open turn, so the client stops there", async () => {
    const reply = await send(userA, turnOfB, initialize);

    expect(reply.status).toBe(401);
    expect(reply.body).toMatchObject({ error: { code: "unauthorized" } });
  });
});
