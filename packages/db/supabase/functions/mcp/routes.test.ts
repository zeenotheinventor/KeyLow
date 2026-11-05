import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { createRegistry, toolRegistry } from "../_shared/assistant/registry.ts";
import {
  createFakeActionStore,
  fakeReadTool,
  fakeWriteTool,
  spyOnConsole,
} from "../_shared/assistant/testing.ts";
import { error } from "../_shared/http.ts";
import { createMcpEndpoint } from "./routes.ts";
import { turnStatuses } from "./turns.ts";

import type { FakeActionStore } from "../_shared/assistant/testing.ts";
import type { ToolDefinition, ToolRegistry } from "../_shared/assistant/tool.ts";
import type { ReportError } from "../_shared/report.ts";
import type { McpDependencies } from "./routes.ts";
import type { McpTurn } from "./turns.ts";

const userId = "00000000-0000-4000-8000-0000000000a1";
const otherUserId = "00000000-0000-4000-8000-0000000000b2";
const conversationId = "00000000-0000-4000-8000-0000000000c1";
const turnId = "00000000-0000-4000-8000-0000000000d3";
const secretNote = "my private lunch note 4821";
const startedAt = new Date("2026-11-03T10:00:00.000Z");
const minute = 60_000;

type Fake = {
  dependencies: McpDependencies;
  actions: FakeActionStore;
  messageLookups: string[];
  reports: string[];
};

type FakeOptions = {
  registry?: ToolRegistry;
  turn?: Partial<McpTurn> | null;
  // Who owns the turn. The store answers a turn only to its owner.
  turnOwner?: string;
  signedIn?: boolean;
  userMessageText?: string | null;
  ageMilliseconds?: number;
};

function fake(options: FakeOptions = {}): Fake {
  const actions = createFakeActionStore();
  const messageLookups: string[] = [];
  const reports: string[] = [];
  const report: ReportError = (functionName, code) => {
    reports.push(`${functionName} ${code}`);
  };
  const turn: McpTurn | null =
    options.turn === null
      ? null
      : {
          id: turnId,
          conversationId,
          userMessageId: "00000000-0000-4000-8000-0000000000f6",
          status: "open",
          createdAt: startedAt,
          ...options.turn,
        };
  const dependencies: McpDependencies = {
    authenticate: (_request) =>
      Promise.resolve(
        options.signedIn === false ? error("unauthorized", "Sign in.") : { id: userId },
      ),
    turns: {
      findTurn: (forUser, id) =>
        Promise.resolve(
          turn !== null && (options.turnOwner ?? userId) === forUser && turn.id === id
            ? turn
            : null,
        ),
      userMessageText: (_forUser, forTurn) => {
        messageLookups.push(forTurn.id);
        return Promise.resolve(
          "userMessageText" in options ? (options.userMessageText ?? null) : "log my lunch",
        );
      },
    },
    caller: () => Object.create(null),
    actions,
    registry: options.registry ?? createRegistry([fakeReadTool("read_one").definition]),
    now: () => new Date(startedAt.getTime() + (options.ageMilliseconds ?? 0)),
    report,
  };
  return { dependencies, actions, messageLookups, reports };
}

type CallOptions = {
  turn?: string | null;
  method?: string;
  headers?: Record<string, string>;
  // Headers the default request carries and this one leaves out.
  omitHeaders?: string[];
};

function post(
  dependencies: McpDependencies,
  body: unknown,
  { turn = turnId, method = "POST", headers = {}, omitHeaders = [] }: CallOptions = {},
): Promise<Response> {
  const url = new URL("http://localhost/functions/v1/mcp");
  if (turn !== null) {
    url.searchParams.set("turn", turn);
  }
  const requestHeaders = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "x-kilo-local-date": "2026-11-03",
    "x-kilo-local-time": "08:10",
    ...headers,
  });
  omitHeaders.forEach((name) => requestHeaders.delete(name));
  return createMcpEndpoint(dependencies)(
    new Request(url, {
      method,
      headers: requestHeaders,
      body: method === "POST" ? JSON.stringify(body) : null,
    }),
  );
}

// The transport answers a stateless request as one server-sent event or as plain JSON.
async function resultOf(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  const parsed: unknown = JSON.parse(data ?? text);
  assert(typeof parsed === "object" && parsed !== null && "result" in parsed);
  const { result } = parsed;
  assert(typeof result === "object" && result !== null);
  return Object.fromEntries(Object.entries(result));
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  },
};
const listTools = { jsonrpc: "2.0", id: 2, method: "tools/list" };
const callTool = (name: string, args: unknown) => ({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name, arguments: args },
});

Deno.test("initialize answers the server and its tools capability", async () => {
  const response = await post(fake().dependencies, initialize);

  assertEquals(response.status, 200);
  const result = await resultOf(response);
  assertEquals(result["serverInfo"], { name: "kilo-assistant-tools", version: "1.0.0" });
  assertEquals(result["capabilities"], { tools: {} });
});

Deno.test(
  "tools/list answers every registry tool in registry order, as closed object schemas with the kind's hint",
  async () => {
    const response = await post(fake({ registry: toolRegistry }).dependencies, listTools);

    assertEquals(response.status, 200);
    const { tools } = await resultOf(response);
    assert(Array.isArray(tools));
    assertEquals(
      tools.map((tool) => tool.name),
      toolRegistry.list.map((tool) => tool.name),
    );
    for (const tool of tools) {
      assertEquals(tool.annotations.readOnlyHint, toolRegistry.get(tool.name)?.kind === "read");
      assertEquals(tool.inputSchema.type, "object");
      assertEquals(tool.inputSchema.additionalProperties, false);
    }
  },
);

Deno.test("tools/list carries a write tool's annotations and its confirmation_id", async () => {
  const write = fakeWriteTool({ needsConfirmation: () => true }).definition;
  const registry = createRegistry([fakeReadTool("read_one").definition, write]);

  const { tools } = await resultOf(await post(fake({ registry }).dependencies, listTools));

  assert(Array.isArray(tools));
  assertEquals(tools[1].annotations, { readOnlyHint: false, destructiveHint: false });
  assert("confirmation_id" in tools[1].inputSchema.properties);
});

Deno.test("tools/list does not change with the allowed tools", async () => {
  const { dependencies } = fake({ registry: toolRegistry });
  const names = async (headers: Record<string, string>) => {
    const { tools } = await resultOf(await post(dependencies, listTools, { headers }));
    assert(Array.isArray(tools));
    return tools.map((tool) => tool.name);
  };

  const none = await names({});
  assertEquals(await names({ "x-kilo-allowed-tools": "get_food" }), none);
  assertEquals(await names({ "x-kilo-allowed-tools": "" }), none);
});

Deno.test(
  "tools/call wraps the result as untrusted data and answers the outcome as structuredContent",
  async () => {
    const read = fakeReadTool("read_one", {
      data: { rows: ["Oats"] },
      structured: { card: "oats" },
    });
    const { dependencies } = fake({ registry: createRegistry([read.definition]) });

    const response = await post(dependencies, callTool("read_one", { note: "x" }), {
      headers: { "x-kilo-allowed-tools": "read_one" },
    });

    const result = await resultOf(response);
    assertEquals(result["isError"] ?? false, false);
    assert(Array.isArray(result["content"]));
    assertEquals(result["content"].length, 1);
    assertEquals(result["content"][0].type, "text");
    assertStringIncludes(result["content"][0].text, '<untrusted_data source="read_one">');
    assertEquals(result["structuredContent"], {
      status: "ok",
      structured: { card: "oats" },
      actionId: null,
    });
    assertEquals(read.runs, [{ note: "x" }]);
  },
);

Deno.test(
  "a user id in the structured outcome never reaches the text the model reads",
  async () => {
    const read = fakeReadTool("read_one", {
      data: { rows: [] },
      structured: { owner: userId },
    });
    const { dependencies } = fake({ registry: createRegistry([read.definition]) });

    const result = await resultOf(
      await post(dependencies, callTool("read_one", { note: "x" }), {
        headers: { "x-kilo-allowed-tools": "read_one" },
      }),
    );

    assertEquals(JSON.stringify(result["content"]).includes(userId), false);
    assertEquals(JSON.stringify(result["structuredContent"]).includes(userId), true);
  },
);

Deno.test(
  "tools/call refuses a tool outside X-Kilo-Allowed-Tools, and every tool without the header",
  async () => {
    const read = fakeReadTool("read_one");
    const { dependencies } = fake({ registry: createRegistry([read.definition]) });
    const headerCases: Record<string, string>[] = [{ "x-kilo-allowed-tools": "get_food" }, {}];
    for (const headers of headerCases) {
      const result = await resultOf(
        await post(dependencies, callTool("read_one", { note: "x" }), { headers }),
      );

      assertEquals(result["isError"], true);
      assertEquals(result["structuredContent"], { status: "error", code: "tool_not_allowed" });
      assertStringIncludes(JSON.stringify(result["content"]), "tool_not_allowed");
    }
    assertEquals(read.runs, []);
  },
);

Deno.test(
  "the allowed tools are a comma-separated list, spaces around a name ignored",
  async () => {
    const first = fakeReadTool("read_one");
    const second = fakeReadTool("read_two");
    const { dependencies } = fake({
      registry: createRegistry([first.definition, second.definition]),
    });

    const result = await resultOf(
      await post(dependencies, callTool("read_two", { note: "x" }), {
        headers: { "x-kilo-allowed-tools": "read_one , read_two" },
      }),
    );

    assertEquals(result["isError"] ?? false, false);
    assertEquals(second.runs.length, 1);
  },
);

Deno.test("tools/call answers the executor's invalid_input and not a server error", async () => {
  const read = fakeReadTool("read_one");
  const { dependencies } = fake({ registry: createRegistry([read.definition]) });

  const response = await post(dependencies, callTool("read_one", { note: 42 }), {
    headers: { "x-kilo-allowed-tools": "read_one" },
  });

  assertEquals(response.status, 200);
  const result = await resultOf(response);
  assertEquals(result["isError"], true);
  assertEquals(result["structuredContent"], { status: "error", code: "invalid_input" });
  assertEquals(read.runs, []);
});

Deno.test(
  "tools/call answers unknown_tool for a name the registry lacks, when it is allowed",
  async () => {
    const result = await resultOf(
      await post(fake().dependencies, callTool("no_such_tool", {}), {
        headers: { "x-kilo-allowed-tools": "no_such_tool" },
      }),
    );

    assertEquals(result["structuredContent"], { status: "error", code: "unknown_tool" });
  },
);

Deno.test("a write runs under the turn and the user message the function loaded", async () => {
  const write = fakeWriteTool();
  const made = fake({ registry: createRegistry([write.definition]) });

  const result = await resultOf(
    await post(made.dependencies, callTool("fake_write", { note: "lunch" }), {
      headers: { "x-kilo-allowed-tools": "fake_write" },
    }),
  );

  assertEquals(write.runs, [{ note: "lunch" }]);
  assertEquals(made.actions.actions.length, 1);
  assertEquals(made.actions.actions[0]?.turnId, turnId);
  assertEquals(made.actions.actions[0]?.conversationId, conversationId);
  assertEquals(made.actions.actions[0]?.userId, userId);
  assertEquals(made.messageLookups, [turnId]);
  const outcome = result["structuredContent"];
  assert(typeof outcome === "object" && outcome !== null && "actionId" in outcome);
  assertEquals(outcome["actionId"], made.actions.actions[0]?.id);
});

Deno.test("a tool is given the recipe import's services when the function has them", async () => {
  const seen: boolean[] = [];
  const probe: ToolDefinition = {
    ...fakeReadTool("read_probe").definition,
    run(ctx) {
      seen.push(ctx.recipeImport !== undefined);
      return Promise.resolve({ data: { rows: [] } });
    },
  };
  const services = {
    fetchPage: () => Promise.resolve({ ok: false as const, code: "timeout" as const }),
    parse: () => Promise.resolve({ ok: false as const, code: "failed" as const }),
  };
  const call = (dependencies: McpDependencies) =>
    post(dependencies, callTool("read_probe", { note: "x" }), {
      headers: { "x-kilo-allowed-tools": "read_probe" },
    });

  const without = fake({ registry: createRegistry([probe]) });
  const withServices = fake({ registry: createRegistry([probe]) });
  await call(without.dependencies);
  await call({ ...withServices.dependencies, recipeImport: services });

  assertEquals(seen, [false, true]);
});

Deno.test("a write on a turn without a user message answers no_user_message", async () => {
  const write = fakeWriteTool();
  const made = fake({ registry: createRegistry([write.definition]), userMessageText: null });

  const result = await resultOf(
    await post(made.dependencies, callTool("fake_write", { note: "lunch" }), {
      headers: { "x-kilo-allowed-tools": "fake_write" },
    }),
  );

  assertEquals(result["structuredContent"], { status: "error", code: "no_user_message" });
  assertEquals(write.runs, []);
});

Deno.test(
  "a write that needs a confirmation answers the confirmation id as structuredContent",
  async () => {
    const write = fakeWriteTool({ needsConfirmation: () => true });
    const made = fake({ registry: createRegistry([write.definition]) });

    const result = await resultOf(
      await post(made.dependencies, callTool("fake_write", { note: "lunch" }), {
        headers: { "x-kilo-allowed-tools": "fake_write" },
      }),
    );

    const outcome = Object.entries(result["structuredContent"] ?? {});
    assertEquals(
      outcome.map(([key]) => key),
      ["status", "confirmationId"],
    );
    assertEquals(outcome[0]?.[1], "needs_confirmation");
    assertEquals(typeof outcome[1]?.[1], "string");
    assertEquals(result["isError"] ?? false, false);
    assertEquals(write.runs, []);
  },
);

Deno.test(
  "a write that asks with a note answers the note as structuredContent after the confirmation id",
  async () => {
    const write = fakeWriteTool({ needsConfirmation: () => ({ note: "A line." }) });
    const made = fake({ registry: createRegistry([write.definition]) });

    const result = await resultOf(
      await post(made.dependencies, callTool("fake_write", { note: "lunch" }), {
        headers: { "x-kilo-allowed-tools": "fake_write" },
      }),
    );

    const outcome = Object.entries(result["structuredContent"] ?? {});
    assertEquals(
      outcome.map(([key]) => key),
      ["status", "confirmationId", "note"],
    );
    assertEquals(outcome[2]?.[1], "A line.");
    assertEquals(write.runs, []);
  },
);

Deno.test("tools/list and initialize do not read the user message", async () => {
  const made = fake();

  await post(made.dependencies, initialize);
  await post(made.dependencies, listTools);

  assertEquals(made.messageLookups, []);
});

Deno.test("no JWT is a 401 and nothing is read", async () => {
  const made = fake({ signedIn: false });

  const response = await post(made.dependencies, listTools);

  assertEquals(response.status, 401);
  assertEquals((await response.json()).error.code, "unauthorized");
});

Deno.test("a missing or malformed turn is a 400", async () => {
  const { dependencies } = fake();
  for (const turn of [null, "", "not-a-uuid", `${turnId}x`]) {
    const response = await post(dependencies, listTools, { turn });

    assertEquals(response.status, 400, `turn ${String(turn)}`);
    assertEquals((await response.json()).error.code, "invalid_request");
  }
});

Deno.test(
  "a missing or malformed local date or time is a 400, and a missing time is fine",
  async () => {
    const { dependencies } = fake();
    const refused: Record<string, string>[] = [
      { "x-kilo-local-date": "" },
      { "x-kilo-local-date": "2026-13-45" },
      { "x-kilo-local-date": "3 November" },
      { "x-kilo-local-time": "8:10" },
      { "x-kilo-local-time": "24:00" },
      { "x-kilo-local-time": "" },
    ];
    for (const headers of refused) {
      const response = await post(dependencies, listTools, { headers });

      assertEquals(response.status, 400, JSON.stringify(headers));
      assertEquals((await response.json()).error.code, "invalid_request");
    }
    const noDate = await post(dependencies, listTools, { omitHeaders: ["x-kilo-local-date"] });
    assertEquals(noDate.status, 400);
    const noTime = await post(dependencies, listTools, { omitHeaders: ["x-kilo-local-time"] });
    assertEquals(noTime.status, 200);
  },
);

Deno.test(
  "the turn the tool runs in carries the local date and time, and null when no time",
  async () => {
    const seen: unknown[] = [];
    const reading: ToolDefinition = {
      ...fakeReadTool("read_one").definition,
      run: (ctx) => {
        seen.push([ctx.turn.localDate, ctx.turn.localTime]);
        return Promise.resolve({ data: null });
      },
    };
    const { dependencies } = fake({ registry: createRegistry([reading]) });
    const allowed = { "x-kilo-allowed-tools": "read_one" };

    await post(dependencies, callTool("read_one", { note: "x" }), { headers: allowed });
    await post(dependencies, callTool("read_one", { note: "x" }), {
      headers: allowed,
      omitHeaders: ["x-kilo-local-time"],
    });

    assertEquals(seen, [
      ["2026-11-03", "08:10"],
      ["2026-11-03", null],
    ]);
  },
);

Deno.test("a turn that is not the user's, not found, not open or too old is a 401", async () => {
  const cases: [string, FakeOptions][] = [
    ["another user's turn", { turnOwner: otherUserId }],
    ["no such turn", { turn: null }],
    ...turnStatuses
      .filter((status) => status !== "open")
      .map((status): [string, FakeOptions] => [`a ${status} turn`, { turn: { status } }]),
    ["a turn 5 minutes old", { ageMilliseconds: 5 * minute }],
    ["a turn an hour old", { ageMilliseconds: 60 * minute }],
  ];
  for (const [label, options] of cases) {
    const response = await post(fake(options).dependencies, listTools);

    assertEquals(response.status, 401, label);
    assertEquals((await response.json()).error.code, "unauthorized", label);
  }
});

Deno.test("a turn just under 5 minutes old is served", async () => {
  const response = await post(fake({ ageMilliseconds: 5 * minute - 1 }).dependencies, listTools);

  assertEquals(response.status, 200);
});

Deno.test("only POST is served", async () => {
  for (const method of ["GET", "DELETE"]) {
    const response = await post(fake().dependencies, null, { method });

    assertEquals(response.status, 405, method);
    assertEquals(response.headers.get("allow"), "POST");
  }
});

Deno.test("a tool that throws answers tool_failed and reports the failure", async () => {
  const failing: ToolDefinition = {
    ...fakeReadTool("read_one").definition,
    run: () => Promise.reject(new Error(secretNote)),
  };
  const made = fake({ registry: createRegistry([failing]) });

  const response = await post(made.dependencies, callTool("read_one", { note: "x" }), {
    headers: { "x-kilo-allowed-tools": "read_one" },
  });

  assertEquals(response.status, 200);
  const result = await resultOf(response);
  assertEquals(result["structuredContent"], { status: "error", code: "tool_failed" });
  assertEquals(made.reports, ["assistant tool read_one internal_error"]);
});

Deno.test(
  "a log line holds the user, the tool, a code and the time, and never an argument or a result",
  async () => {
    const read = fakeReadTool("read_one", {
      data: { rows: [secretNote] },
      structured: { card: secretNote },
    });
    const spy = spyOnConsole();
    try {
      const { dependencies } = fake({ registry: createRegistry([read.definition]) });
      const headers = { "x-kilo-allowed-tools": "read_one" };
      await (
        await post(dependencies, callTool("read_one", { note: secretNote }), { headers })
      ).text();
      await (await post(dependencies, callTool("read_one", { note: 42 }), { headers })).text();
      await (await post(dependencies, callTool(secretNote, { note: "x" }), { headers })).text();
      await (
        await post(dependencies, callTool("read_one", { note: secretNote }), { turn: "not-a-uuid" })
      ).text();
      await (await post(fake({ turn: { status: "complete" } }).dependencies, listTools)).text();
    } finally {
      spy.restore();
    }

    assertEquals(
      spy.lines.filter((line) => line.includes(secretNote)),
      [],
    );
    const calls = spy.lines.filter((line) => line.startsWith("mcp call"));
    assertEquals(calls.length, 3);
    assertStringIncludes(calls[0] ?? "", `user=${userId} tool=read_one code=ok`);
    assertStringIncludes(calls[1] ?? "", "tool=read_one code=invalid_input");
    assertStringIncludes(calls[2] ?? "", "tool=unknown code=tool_not_allowed");
    assert(spy.lines.some((line) => line.includes("gate=turn_not_open")));
  },
);

Deno.test("a failed read of the user message is reported and answers tool_failed", async () => {
  const made = fake();
  made.dependencies.turns.userMessageText = () => Promise.reject(new Error(secretNote));
  const spy = spyOnConsole();
  let text: string;
  try {
    const response = await post(made.dependencies, callTool("read_one", { note: "x" }), {
      headers: { "x-kilo-allowed-tools": "read_one" },
    });
    assertEquals(response.status, 200);
    text = await response.text();
  } finally {
    spy.restore();
  }

  assertStringIncludes(text, "tool_failed");
  assertEquals(text.includes(secretNote), false);
  assertEquals(made.reports, ["mcp internal_error"]);
});

Deno.test(
  "a request the transport rejects is reported with a code, never its message",
  async () => {
    const made = fake();

    const response = await post(made.dependencies, "this is not JSON-RPC");

    assertEquals(response.status >= 400, true);
    assertEquals(made.reports, ["mcp internal_error"]);
  },
);
