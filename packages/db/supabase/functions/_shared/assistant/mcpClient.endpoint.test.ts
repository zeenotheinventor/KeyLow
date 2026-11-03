// The MCP client against the real `mcp` request handler (`createMcpEndpoint`, with the real executor and
// server) served over HTTP, so the sign-in, the turn binding and the allowlist are the ones the function
// enforces. Only the stores behind it are fakes.
import { assert, assertEquals } from "@std/assert";

import { createMcpEndpoint } from "../../mcp/routes.ts";
import { error } from "../http.ts";
import { connectToolServer, McpClientError } from "./mcpClient.ts";
import { createRegistry } from "./registry.ts";
import { createFakeActionStore, fakeReadTool, otherUserId, turnId, userId } from "./testing.ts";

import type { ConnectToolServerOptions } from "./mcpClient.ts";

const tokenOfUser = "token-of-user-a";
const tokenOfOtherUser = "token-of-user-b";
const turnOfOtherUser = "00000000-0000-4000-8000-0000000000e4";

type Served = { baseUrl: string; postCount: () => number; shutdown: () => Promise<void> };

async function serveMcpFunction(): Promise<Served> {
  const turns = [
    { id: turnId, userId },
    { id: turnOfOtherUser, userId: otherUserId },
  ];
  const endpoint = createMcpEndpoint({
    authenticate: (request) => {
      const bearer = request.headers.get("authorization");
      const signedIn =
        bearer === `Bearer ${tokenOfUser}`
          ? userId
          : bearer === `Bearer ${tokenOfOtherUser}`
            ? otherUserId
            : null;
      return Promise.resolve(
        signedIn === null ? error("unauthorized", "Sign in.") : { id: signedIn },
      );
    },
    turns: {
      findTurn: (forUser, id) => {
        const turn = turns.find((known) => known.id === id && known.userId === forUser);
        return Promise.resolve(
          turn === undefined
            ? null
            : {
                id,
                conversationId: "00000000-0000-4000-8000-0000000000c1",
                userMessageId: "00000000-0000-4000-8000-0000000000f6",
                status: "open",
                createdAt: new Date(),
              },
        );
      },
      userMessageText: () => Promise.resolve("log my lunch"),
    },
    caller: () => Object.create(null),
    actions: createFakeActionStore(),
    registry: createRegistry([fakeReadTool("read_one").definition]),
    now: () => new Date(),
    report: () => {},
  });
  let posts = 0;
  const listening = Promise.withResolvers<number>();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    (request) => {
      posts += request.method === "POST" ? 1 : 0;
      return endpoint(request);
    },
  );
  return {
    baseUrl: `http://127.0.0.1:${await listening.promise}`,
    postCount: () => posts,
    shutdown: () => server.shutdown(),
  };
}

async function withServedFunction(body: (served: Served) => Promise<void>): Promise<void> {
  const served = await serveMcpFunction();
  try {
    await body(served);
  } finally {
    await served.shutdown();
  }
}

function options(
  served: Served,
  overrides: Partial<ConnectToolServerOptions>,
): ConnectToolServerOptions {
  return {
    functionsBaseUrl: served.baseUrl,
    turnId,
    accessToken: tokenOfUser,
    allowedTools: ["read_one"],
    turnHasAction: () => Promise.resolve(false),
    ...overrides,
  };
}

Deno.test("the user's JWT with the user's open turn lists the tools and calls one", async () => {
  await withServedFunction(async (served) => {
    const connection = await connectToolServer(options(served, {}));

    const tools = await connection.listTools();
    const result = await connection.callTool("read_one", { note: "hello", extra: null });

    assertEquals(
      tools.map((tool) => tool.name),
      ["read_one"],
    );
    assert(result.text.includes("<untrusted_data"));
    assertEquals(result.isError, false);
    assertEquals(result.outcome.status, "ok");
    await connection.close();
  });
});

Deno.test(
  "a tool outside X-Kilo-Allowed-Tools comes back as the executor's tool_not_allowed",
  async () => {
    await withServedFunction(async (served) => {
      const connection = await connectToolServer(options(served, { allowedTools: [] }));

      const result = await connection.callTool("read_one", { note: "hello", extra: null });

      assertEquals(result.isError, true);
      assertEquals(result.outcome, { status: "error", code: "tool_not_allowed" });
      await connection.close();
    });
  },
);

Deno.test(
  "the user's JWT with another user's turn is mcp_unauthorised and the client asks once",
  async () => {
    await withServedFunction(async (served) => {
      const failure = await connectToolServer(options(served, { turnId: turnOfOtherUser })).then(
        () => null,
        (caught: unknown) => caught,
      );

      assert(failure instanceof McpClientError);
      assertEquals(failure.code, "mcp_unauthorised");
      assertEquals(served.postCount(), 1);
    });
  },
);

Deno.test(
  "a JWT the function does not know is mcp_unauthorised and the client asks once",
  async () => {
    await withServedFunction(async (served) => {
      const failure = await connectToolServer(options(served, { accessToken: "not-a-token" })).then(
        () => null,
        (caught: unknown) => caught,
      );

      assert(failure instanceof McpClientError);
      assertEquals(failure.code, "mcp_unauthorised");
      assertEquals(served.postCount(), 1);
    });
  },
);
