import { createServer } from "node:http";
import { text } from "node:stream/consumers";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createUndoTurn } from "../src/undoTurn.ts";

import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

// A stub of the served `assistant` function's undo route: a real HTTP server that answers with the body a test
// sets and keeps the request it received. The eval user's client is a fake that answers the one read.

type Received = { path: string; headers: IncomingMessage["headers"]; body: unknown };

let server: Server;
let baseUrl: string;
let received: Received[] = [];
let answer: (response: ServerResponse) => void = () => undefined;

beforeAll(async () => {
  server = createServer((request, response) => {
    void text(request).then((body) => {
      received.push({
        path: request.url ?? "",
        headers: request.headers,
        body: JSON.parse(body) as unknown,
      });
      answer(response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const answerWith = (status: number, body: unknown) => {
  answer = (response) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
};

/** The eval user's client, which answers the read of the turn's action ids and records what it was asked. */
function clientWithActions(ids: readonly string[], error: { code: string } | null = null) {
  const asked: string[] = [];
  const client = {
    from(table: string) {
      asked.push(`from ${table}`);
      return {
        select(columns: string) {
          asked.push(`select ${columns}`);
          return {
            eq(column: string, value: string) {
              asked.push(`eq ${column} ${value}`);
              return {
                order: (orderColumn: string) => {
                  asked.push(`order ${orderColumn}`);
                  return Promise.resolve({ data: ids.map((id) => ({ id })), error });
                },
              };
            },
          };
        },
      };
    },
    // The fake answers only the one read the undo makes, so it stands in for the whole client type.
  } as unknown as SupabaseClient<Database>;
  return { client, asked };
}

const undoTurnFor = (client: SupabaseClient<Database>) => {
  received = [];
  return createUndoTurn({
    apiUrl: baseUrl,
    anonKey: "anon-key-for-tests",
    getAccessToken: () => Promise.resolve("token-for-tests"),
    client,
  });
};

const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";

describe("createUndoTurn", () => {
  it("should read the actions of the turn in the order they were written", async () => {
    const { client, asked } = clientWithActions([FIRST]);
    answerWith(200, { results: [{ actionId: FIRST, result: "undone" }] });

    await undoTurnFor(client)("turn-a");

    expect(asked).toEqual([
      "from assistant_actions",
      "select id",
      "eq turn_id turn-a",
      "order turn_seq",
    ]);
  });

  it("should post the action ids to the undo route as the eval user and answer each outcome in order", async () => {
    const { client } = clientWithActions([FIRST, SECOND]);
    answerWith(200, {
      results: [
        { actionId: FIRST, result: "undone" },
        { actionId: SECOND, result: "undo_unavailable" },
      ],
    });

    const outcomes = await undoTurnFor(client)("turn-a");

    expect(outcomes).toEqual(["undone", "undo_unavailable"]);
    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("/functions/v1/assistant/undo");
    expect(received[0]?.headers["authorization"]).toBe("Bearer token-for-tests");
    expect(received[0]?.headers["apikey"]).toBe("anon-key-for-tests");
    expect(received[0]?.body).toEqual({ actionIds: [FIRST, SECOND] });
  });

  it("should answer an empty list, and call nothing, for a turn that wrote nothing", async () => {
    const { client } = clientWithActions([]);

    const outcomes = await undoTurnFor(client)("turn-a");

    expect(outcomes).toEqual([]);
    expect(received).toEqual([]);
  });

  it("should fail with the status, and never the body, when the route refuses", async () => {
    const { client } = clientWithActions([FIRST]);
    answerWith(401, { error: { code: "unauthorised", message: "secret words" } });

    await expect(undoTurnFor(client)("turn-a")).rejects.toThrow("The undo route answered 401");
    await expect(undoTurnFor(client)("turn-a")).rejects.not.toThrow(/secret words/);
  });

  it("should fail with the database code when the actions cannot be read", async () => {
    const { client } = clientWithActions([], { code: "42501" });

    await expect(undoTurnFor(client)("turn-a")).rejects.toThrow(
      "Could not read the actions of the turn (42501)",
    );
  });

  it("should fail when the route answers an outcome it does not know", async () => {
    const { client } = clientWithActions([FIRST]);
    answerWith(200, { results: [{ actionId: FIRST, result: "maybe" }] });

    await expect(undoTurnFor(client)("turn-a")).rejects.toThrow("The undo route answered");
  });

  it("should fail when the route leaves an action out of its answer", async () => {
    const { client } = clientWithActions([FIRST, SECOND]);
    answerWith(200, { results: [{ actionId: FIRST, result: "undone" }] });

    await expect(undoTurnFor(client)("turn-a")).rejects.toThrow("The undo route answered");
  });
});
