import { assert, assertEquals, assertInstanceOf, assertRejects } from "@std/assert";

import { connectToolServer, McpClientError, mayRetry } from "./mcpClient.ts";
import { readToolName, startTestServer, writeToolName } from "./mcpTestServer.ts";
import { createRegistry } from "./registry.ts";
import { fakeReadTool, fakeWriteTool, spyOnConsole, turnId } from "./testing.ts";

import type { ConnectToolServerOptions } from "./mcpClient.ts";
import type { RecordedRequest, TestServer, TestServerOptions } from "./mcpTestServer.ts";

const accessToken = "sentinel-access-token-7731";
const allowedTools = [readToolName, writeToolName];
const noActionRow = () => Promise.resolve(false);
const anActionRow = () => Promise.resolve(true);

async function withServer(
  options: TestServerOptions,
  body: (server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer(options);
  try {
    await body(server);
  } finally {
    await server.shutdown();
  }
}

function connectionOptions(
  server: TestServer,
  overrides: Partial<ConnectToolServerOptions> = {},
): ConnectToolServerOptions {
  return {
    functionsBaseUrl: server.baseUrl,
    turnId,
    accessToken,
    allowedTools,
    localDate: "2026-11-03",
    localTime: "08:10",
    turnHasAction: noActionRow,
    ...overrides,
  };
}

// The first request that matches fails, and the ones after it do not.
function firstMatch(matches: (request: RecordedRequest) => boolean) {
  let seen = false;
  return (request: RecordedRequest) => {
    if (seen || !matches(request)) {
      return false;
    }
    seen = true;
    return true;
  };
}

const isMethod = (method: string) => (request: RecordedRequest) => request.rpc.method === method;
const requestsFor = (server: TestServer, method: string) =>
  server.requests.filter(isMethod(method));
const unauthorised = () => Response.json({ error: { code: "unauthorized" } }, { status: 401 });

async function assertClientError(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await assertRejects(() => promise, McpClientError);
  assertEquals(error.code, code);
}

Deno.test("listTools answers the server's tools in the order the server lists them", async () => {
  await withServer({}, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    const tools = await connection.listTools();

    assertEquals(
      tools.map((tool) => tool.name),
      [readToolName, writeToolName],
    );
    assertEquals(
      tools.map((tool) => tool.readOnlyHint),
      [true, false],
    );
    assertEquals(tools[0]?.inputSchema["additionalProperties"], false);
    await connection.close();
  });
});

Deno.test(
  "the token travels only in Authorization, the allowlist only in X-Kilo-Allowed-Tools, and the URL holds only the turn",
  async () => {
    await withServer({}, async (server) => {
      const connection = await connectToolServer(connectionOptions(server));
      await connection.listTools();
      await connection.callTool(readToolName, { note: "hello" });
      await connection.close();

      assert(server.requests.length >= 4);
      for (const request of server.requests) {
        assertEquals(request.headers.get("authorization"), `Bearer ${accessToken}`);
        assertEquals(
          request.headers.get("x-kilo-allowed-tools"),
          `${readToolName},${writeToolName}`,
        );
        assertEquals(request.url.pathname, "/functions/v1/mcp");
        assertEquals([...request.url.searchParams.keys()], ["turn"]);
        assertEquals(request.url.searchParams.get("turn"), turnId);
        assert(!request.url.href.includes(accessToken));
        for (const [name, value] of request.headers) {
          if (name !== "authorization") {
            assert(!value.includes(accessToken), `${name} holds the token`);
          }
        }
      }
    });
  },
);

Deno.test("listTools says which tools are strict, and a tool that opted out is not", async () => {
  const registry = createRegistry([
    fakeReadTool(readToolName).definition,
    { ...fakeWriteTool({ name: writeToolName }).definition, strict: false },
  ]);
  await withServer({ registry }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    const tools = await connection.listTools();

    assertEquals(
      tools.map((tool) => tool.strict),
      [true, false],
    );
    await connection.close();
  });
});

Deno.test(
  "listTools says which tools belong to the kitchen group and leaves the rest ungrouped",
  async () => {
    const registry = createRegistry([
      fakeReadTool(readToolName).definition,
      { ...fakeReadTool("kitchen_one").definition, group: "kitchen" },
    ]);
    await withServer({ registry }, async (server) => {
      const connection = await connectToolServer(connectionOptions(server));

      const tools = await connection.listTools();

      assertEquals(
        tools.map((tool) => tool.group ?? null),
        [null, "kitchen"],
      );
      await connection.close();
    });
  },
);

Deno.test(
  "every request carries the turn's local date and time, and no time header when there is none",
  async () => {
    await withServer({}, async (server) => {
      const connection = await connectToolServer(connectionOptions(server));
      await connection.listTools();
      await connection.close();

      assert(server.requests.length >= 3);
      for (const request of server.requests) {
        assertEquals(request.headers.get("x-kilo-local-date"), "2026-11-03");
        assertEquals(request.headers.get("x-kilo-local-time"), "08:10");
      }
    });
    await withServer({}, async (server) => {
      const connection = await connectToolServer(connectionOptions(server, { localTime: null }));
      await connection.listTools();
      await connection.close();

      for (const request of server.requests) {
        assertEquals(request.headers.get("x-kilo-local-date"), "2026-11-03");
        assertEquals(request.headers.get("x-kilo-local-time"), null);
      }
    });
  },
);

Deno.test("callTool answers the executor's wrapped text and the structured outcome", async () => {
  await withServer(
    {
      callTool: () =>
        Promise.resolve({
          status: "ok",
          text: "<untrusted_data>saved</untrusted_data>",
          structured: { card: "saved" },
          actionId: "action-1",
        }),
    },
    async (server) => {
      const connection = await connectToolServer(connectionOptions(server));
      await connection.listTools();

      const result = await connection.callTool(writeToolName, { note: "hello" });

      assertEquals(result, {
        text: "<untrusted_data>saved</untrusted_data>",
        isError: false,
        outcome: { status: "ok", structured: { card: "saved" }, actionId: "action-1" },
      });
      await connection.close();
    },
  );
});

Deno.test(
  "callTool answers needs_confirmation with its confirmation id and the tool's question",
  async () => {
    await withServer(
      {
        callTool: () =>
          Promise.resolve({
            status: "needs_confirmation",
            text: "confirm?",
            confirmationId: "c-1",
            question: "Delete 2 entries?",
          }),
      },
      async (server) => {
        const connection = await connectToolServer(connectionOptions(server));

        const result = await connection.callTool(writeToolName, {});

        assertEquals(result.isError, false);
        assertEquals(result.outcome, {
          status: "needs_confirmation",
          confirmationId: "c-1",
          question: "Delete 2 entries?",
        });
        await connection.close();
      },
    );
  },
);

Deno.test(
  "callTool carries the note of a confirmation across, and leaves the key out without one",
  async () => {
    await withServer(
      {
        callTool: () =>
          Promise.resolve({
            status: "needs_confirmation",
            text: "confirm?",
            confirmationId: "c-1",
            question: "Delete 2 entries?",
            note: "A line.",
          }),
      },
      async (server) => {
        const connection = await connectToolServer(connectionOptions(server));

        const result = await connection.callTool(writeToolName, {});

        assertEquals(result.outcome, {
          status: "needs_confirmation",
          confirmationId: "c-1",
          question: "Delete 2 entries?",
          note: "A line.",
        });
        await connection.close();
      },
    );
  },
);

Deno.test("callTool carries asksAgain across when the confirmation was asked again", async () => {
  await withServer(
    {
      callTool: () =>
        Promise.resolve({
          status: "needs_confirmation",
          text: "confirm?",
          confirmationId: "c-2",
          question: "Delete 2 entries?",
          asksAgain: true,
        }),
    },
    async (server) => {
      const connection = await connectToolServer(connectionOptions(server));

      const result = await connection.callTool(writeToolName, {});

      assertEquals(result.outcome, {
        status: "needs_confirmation",
        confirmationId: "c-2",
        question: "Delete 2 entries?",
        asksAgain: true,
      });
      await connection.close();
    },
  );
});

Deno.test("a result with isError true comes back as isError, not as a throw", async () => {
  await withServer(
    {
      callTool: () =>
        Promise.resolve({ status: "error", code: "invalid_input", text: "<untrusted_data/>" }),
    },
    async (server) => {
      const connection = await connectToolServer(connectionOptions(server));

      const result = await connection.callTool(readToolName, {});

      assertEquals(result.isError, true);
      assertEquals(result.text, "<untrusted_data/>");
      assertEquals(result.outcome, { status: "error", code: "invalid_input" });
      assertEquals(requestsFor(server, "tools/call").length, 1);
      await connection.close();
    },
  );
});

Deno.test("a result without structuredContent is an mcp_protocol error", async () => {
  const answer = (request: RecordedRequest) =>
    request.rpc.method === "tools/call"
      ? Response.json({
          jsonrpc: "2.0",
          id: request.rpc.id,
          result: { content: [{ type: "text", text: "x" }] },
        })
      : undefined;
  await withServer({ answer }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    await assertClientError(connection.callTool(writeToolName, {}), "mcp_protocol");
    await connection.close();
  });
});

Deno.test("a JSON-RPC error is an mcp_protocol error", async () => {
  const answer = (request: RecordedRequest) =>
    request.rpc.method === "tools/call"
      ? Response.json({
          jsonrpc: "2.0",
          id: request.rpc.id,
          error: { code: -32602, message: "Unknown tool" },
        })
      : undefined;
  await withServer({ answer }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    await assertClientError(connection.callTool(writeToolName, {}), "mcp_protocol");
    await connection.close();
  });
});

Deno.test("a 401 on connect is mcp_unauthorised and is not retried", async () => {
  await withServer({ answer: unauthorised }, async (server) => {
    await assertClientError(connectToolServer(connectionOptions(server)), "mcp_unauthorised");

    assertEquals(requestsFor(server, "initialize").length, 1);
  });
});

Deno.test("a 400 on connect is mcp_bad_request and is not retried", async () => {
  const answer = () => Response.json({ error: { code: "invalid_request" } }, { status: 400 });
  await withServer({ answer }, async (server) => {
    await assertClientError(connectToolServer(connectionOptions(server)), "mcp_bad_request");

    assertEquals(requestsFor(server, "initialize").length, 1);
  });
});

Deno.test("a dropped connection on connect is retried once and then answers", async () => {
  await withServer({ dropReply: firstMatch(isMethod("initialize")) }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    assertEquals(requestsFor(server, "initialize").length, 2);
    assertEquals((await connection.listTools()).length, 2);
    await connection.close();
  });
});

Deno.test("a dropped connection on connect twice is mcp_unreachable after one retry", async () => {
  await withServer({ dropReply: isMethod("initialize") }, async (server) => {
    await assertClientError(connectToolServer(connectionOptions(server)), "mcp_unreachable");

    assertEquals(requestsFor(server, "initialize").length, 2);
  });
});

Deno.test("a 503 on connect is mcp_unreachable after one retry", async () => {
  const answer = () => new Response("unavailable", { status: 503 });
  await withServer({ answer }, async (server) => {
    await assertClientError(connectToolServer(connectionOptions(server)), "mcp_unreachable");

    assertEquals(requestsFor(server, "initialize").length, 2);
  });
});

Deno.test("a server that is not there is mcp_unreachable", async () => {
  const server = await startTestServer();
  const baseUrl = server.baseUrl;
  await server.shutdown();

  await assertClientError(
    connectToolServer({ ...connectionOptions(server), functionsBaseUrl: baseUrl }),
    "mcp_unreachable",
  );
});

Deno.test("a reply that takes longer than the request timeout is mcp_unreachable", async () => {
  const answer = async (request: RecordedRequest) => {
    if (request.rpc.method === "tools/list") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return undefined;
  };
  await withServer({ answer }, async (server) => {
    const connection = await connectToolServer(
      connectionOptions(server, { requestTimeoutMilliseconds: 150 }),
    );

    await assertClientError(connection.listTools(), "mcp_unreachable");
    await connection.close();
  });
});

Deno.test("a failed listTools is retried once and then answers", async () => {
  await withServer({ dropReply: firstMatch(isMethod("tools/list")) }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    assertEquals((await connection.listTools()).length, 2);
    assertEquals(requestsFor(server, "tools/list").length, 2);
    await connection.close();
  });
});

Deno.test("a listTools that fails twice is mcp_unreachable after one retry", async () => {
  await withServer({ dropReply: isMethod("tools/list") }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    await assertClientError(connection.listTools(), "mcp_unreachable");
    assertEquals(requestsFor(server, "tools/list").length, 2);
    await connection.close();
  });
});

Deno.test("a failed read call is retried once when the turn has no action row", async () => {
  await withServer({ dropReply: firstMatch(isMethod("tools/call")) }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));
    await connection.listTools();

    const result = await connection.callTool(readToolName, { note: "hello" });

    assertEquals(result.outcome.status, "ok");
    assertEquals(server.toolRuns, [readToolName, readToolName]);
    await connection.close();
  });
});

Deno.test(
  "a failed read call is still retried when the tools were handed in and never listed",
  async () => {
    await withServer({ dropReply: firstMatch(isMethod("tools/call")) }, async (server) => {
      const listing = await connectToolServer(connectionOptions(server));
      const knownTools = await listing.listTools();
      await listing.close();
      const listsBefore = requestsFor(server, "tools/list").length;
      const connection = await connectToolServer(connectionOptions(server, { knownTools }));

      const result = await connection.callTool(readToolName, { note: "hello" });

      assertEquals(result.outcome.status, "ok");
      assertEquals(server.toolRuns, [readToolName, readToolName]);
      assertEquals(requestsFor(server, "tools/list").length, listsBefore);
      await connection.close();
    });
  },
);

Deno.test(
  "a write call to a tool in knownTools is never repeated when its reply is dropped",
  async () => {
    await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
      const listing = await connectToolServer(connectionOptions(server));
      const knownTools = await listing.listTools();
      await listing.close();
      const runsBefore = server.toolRuns.length;
      const connection = await connectToolServer(connectionOptions(server, { knownTools }));

      await assertClientError(
        connection.callTool(writeToolName, { note: "hello" }),
        "mcp_unreachable",
      );

      assertEquals(server.toolRuns.slice(runsBefore), [writeToolName]);
      await connection.close();
    });
  },
);

Deno.test(
  "a call to a tool that is not in knownTools is never repeated when its reply is dropped",
  async () => {
    await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
      const listing = await connectToolServer(connectionOptions(server));
      const knownTools = (await listing.listTools()).filter((tool) => tool.name !== readToolName);
      await listing.close();
      const runsBefore = server.toolRuns.length;
      const connection = await connectToolServer(connectionOptions(server, { knownTools }));

      await assertClientError(connection.callTool(readToolName, {}), "mcp_unreachable");

      assertEquals(server.toolRuns.slice(runsBefore), [readToolName]);
      await connection.close();
    });
  },
);

Deno.test("a read call that fails twice is mcp_unreachable after one retry", async () => {
  await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));
    await connection.listTools();

    await assertClientError(connection.callTool(readToolName, {}), "mcp_unreachable");
    assertEquals(server.toolRuns, [readToolName, readToolName]);
    await connection.close();
  });
});

Deno.test("a failed read call is not retried once the turn has an action row", async () => {
  await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
    const connection = await connectToolServer(
      connectionOptions(server, { turnHasAction: anActionRow }),
    );
    await connection.listTools();

    await assertClientError(connection.callTool(readToolName, {}), "mcp_unreachable");
    assertEquals(server.toolRuns, [readToolName]);
    await connection.close();
  });
});

Deno.test("a failed write call is never repeated, with no action row", async () => {
  await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));
    await connection.listTools();

    await assertClientError(connection.callTool(writeToolName, { note: "x" }), "mcp_unreachable");
    assertEquals(server.toolRuns, [writeToolName]);
    assertEquals(requestsFor(server, "tools/call").length, 1);
    await connection.close();
  });
});

Deno.test("a failed write call is never repeated, with an action row", async () => {
  await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
    const connection = await connectToolServer(
      connectionOptions(server, { turnHasAction: anActionRow }),
    );
    await connection.listTools();

    await assertClientError(connection.callTool(writeToolName, { note: "x" }), "mcp_unreachable");
    assertEquals(server.toolRuns, [writeToolName]);
  });
});

Deno.test("a failed call to a tool the list did not name is never repeated", async () => {
  await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));

    await assertClientError(connection.callTool(readToolName, {}), "mcp_unreachable");
    assertEquals(server.toolRuns, [readToolName]);
  });
});

Deno.test("a read call is not retried when the action row check itself fails", async () => {
  await withServer({ dropReply: isMethod("tools/call") }, async (server) => {
    const connection = await connectToolServer(
      connectionOptions(server, { turnHasAction: () => Promise.reject(new Error("db down")) }),
    );
    await connection.listTools();

    await assertClientError(connection.callTool(readToolName, {}), "mcp_unreachable");
    assertEquals(server.toolRuns, [readToolName]);
  });
});

Deno.test("a 401 on a read call is mcp_unauthorised and is not retried", async () => {
  const answer = (request: RecordedRequest) =>
    request.rpc.method === "tools/call" ? unauthorised() : undefined;
  await withServer({ answer }, async (server) => {
    const connection = await connectToolServer(connectionOptions(server));
    await connection.listTools();

    await assertClientError(connection.callTool(readToolName, {}), "mcp_unauthorised");
    assertEquals(requestsFor(server, "tools/call").length, 1);
  });
});

Deno.test("mayRetry follows the rule for each step and error", async () => {
  const error = (code: ConstructorParameters<typeof McpClientError>[0]) => new McpClientError(code);
  const read = { readOnlyHint: true };
  const write = { readOnlyHint: false };
  const rows: [string, Parameters<typeof mayRetry>[0], boolean, boolean][] = [
    [
      "connect fails once",
      { turnId, step: "connect", attempt: 1, error: error("mcp_unreachable") },
      false,
      true,
    ],
    [
      "connect fails again",
      { turnId, step: "connect", attempt: 2, error: error("mcp_unreachable") },
      false,
      false,
    ],
    [
      "connect, 401",
      { turnId, step: "connect", attempt: 1, error: error("mcp_unauthorised") },
      false,
      false,
    ],
    [
      "connect, 400",
      { turnId, step: "connect", attempt: 1, error: error("mcp_bad_request") },
      false,
      false,
    ],
    [
      "list fails once",
      { turnId, step: "list_tools", attempt: 1, error: error("mcp_protocol") },
      true,
      true,
    ],
    [
      "read, no row",
      { turnId, step: "call_tool", tool: read, attempt: 1, error: error("mcp_unreachable") },
      false,
      true,
    ],
    [
      "read, a row",
      { turnId, step: "call_tool", tool: read, attempt: 1, error: error("mcp_unreachable") },
      true,
      false,
    ],
    [
      "read, second failure",
      { turnId, step: "call_tool", tool: read, attempt: 2, error: error("mcp_unreachable") },
      false,
      false,
    ],
    [
      "write, no row",
      { turnId, step: "call_tool", tool: write, attempt: 1, error: error("mcp_unreachable") },
      false,
      false,
    ],
    [
      "unknown tool",
      { turnId, step: "call_tool", attempt: 1, error: error("mcp_unreachable") },
      false,
      false,
    ],
  ];
  for (const [label, failure, hasRow, expected] of rows) {
    assertEquals(await mayRetry(failure, () => Promise.resolve(hasRow)), expected, label);
  }
});

Deno.test("an MCP client error carries its code and a fixed message", () => {
  const error = new McpClientError("mcp_unauthorised");

  assertInstanceOf(error, Error);
  assertEquals(error.code, "mcp_unauthorised");
  assertEquals(error.name, "McpClientError");
});

Deno.test(
  "the logs hold the turn, the tool, the duration and a code, never the token, an argument or a result",
  async () => {
    const argument = "my private lunch note 4821";
    const resultText = "result sentinel 9902";
    const spy = spyOnConsole();
    try {
      await withServer(
        {
          callTool: () =>
            Promise.resolve({
              status: "ok",
              text: resultText,
              structured: { card: resultText },
              actionId: null,
            }),
        },
        async (server) => {
          const connection = await connectToolServer(connectionOptions(server));
          await connection.listTools();
          await connection.callTool(readToolName, { note: argument });
          await connection.callTool("not_a_listed_tool", { note: argument });
          await connection.close();
        },
      );
    } finally {
      spy.restore();
    }

    const logged = spy.lines.join("\n");
    assert(!logged.includes(accessToken));
    assert(!logged.includes(argument));
    assert(!logged.includes(resultText));
    assert(!logged.includes("not_a_listed_tool"));
    assert(
      spy.lines.some(
        (line) =>
          line.includes(turnId) &&
          line.includes(`tool=${readToolName}`) &&
          /code=ok \d+ms/.test(line),
      ),
    );
    assert(spy.lines.some((line) => line.includes("tool=unknown")));
  },
);

Deno.test("a failure is logged with its code and nothing else", async () => {
  const spy = spyOnConsole();
  try {
    await withServer({ answer: unauthorised }, async (server) => {
      await assertRejects(() => connectToolServer(connectionOptions(server)), McpClientError);
    });
  } finally {
    spy.restore();
  }

  assert(spy.lines.some((line) => line.includes(turnId) && line.includes("code=mcp_unauthorised")));
  assert(!spy.lines.join("\n").includes(accessToken));
});

Deno.test("mcpClient.ts imports nothing from the Anthropic SDK", async () => {
  const source = await Deno.readTextFile(new URL("./mcpClient.ts", import.meta.url));

  const importedModules = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);

  assert(importedModules.length > 0);
  assertEquals(
    importedModules.filter((module) => /anthropic/i.test(module ?? "")),
    [],
  );
});

Deno.test(
  "one listTools round trip costs well under 100 ms, so the list is fetched once per turn and not cached",
  async () => {
    await withServer({}, async (server) => {
      const connection = await connectToolServer(connectionOptions(server));
      await connection.listTools();
      const durations: number[] = [];
      for (let round = 0; round < 20; round++) {
        const startedAt = performance.now();
        await connection.listTools();
        durations.push(performance.now() - startedAt);
      }
      durations.sort((a, b) => a - b);
      const median = durations[Math.floor(durations.length / 2)] ?? Number.POSITIVE_INFINITY;
      console.info(`listTools median ${median.toFixed(1)} ms over ${durations.length} round trips`);

      assert(median < 100, `listTools median was ${median} ms`);
      await connection.close();
    });
  },
);
