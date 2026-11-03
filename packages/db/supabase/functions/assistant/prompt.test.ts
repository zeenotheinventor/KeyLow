import { assert, assertEquals, assertThrows } from "@std/assert";

import { toAnthropicTools } from "../_shared/assistant/adapters/anthropic.ts";
import { toolRegistry } from "../_shared/assistant/registry.ts";
import { toJsonSchema } from "../_shared/assistant/tool.ts";
import { threadFromMessages } from "../_shared/core.ts";
import {
  SYSTEM_PROMPT,
  StoredMessageError,
  buildTurnRequest,
  contextBlock,
  openToolUses,
  toApiMessages,
  userContent,
} from "./prompt.ts";

import type { StoredHistoryMessage } from "./prompt.ts";
import type Anthropic from "@anthropic-ai/sdk";

const tools = toAnthropicTools(
  toolRegistry.list.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchema(tool),
    readOnlyHint: tool.annotations.readOnlyHint,
    strict: tool.strict !== false,
  })),
);

const context = contextBlock({
  now: "2026-10-23T12:00:00Z",
  timeZone: "Europe/London",
  localDate: "2026-10-23",
  localTime: null,
});

let nextId = 0;
const stored = (
  role: StoredHistoryMessage["role"],
  content: unknown,
  turnId = "turn-1",
): StoredHistoryMessage => {
  nextId += 1;
  return { id: `message-${nextId}`, turnId, role, content, display: null };
};

const userText = (text: string, turnId?: string) =>
  stored("user", userContent({ openToolUses: [], context, text }), turnId);

const toolUse = (id: string, name: string) => ({ type: "tool_use", id, name, input: {} });
const toolResult = (id: string): Anthropic.ToolResultBlockParam => ({
  type: "tool_result",
  tool_use_id: id,
  content: "done",
});

// Every key of a value at any depth, for the checks that look at the whole request body.
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
  }
  return [];
}

// A request with its breakpoints taken off, for comparing what is sent and not where the cache reads.
const withoutBreakpoints = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value), (key, child: unknown) =>
    key === "cache_control" ? undefined : child,
  );

Deno.test("the system prompt is well over the 512 token cache minimum", () => {
  // Claude Haiku 5.5 counts about 30 per cent more tokens than older models do, and English runs near
  // 4 characters a token, so 3,600 characters is over 512 tokens even at 7 characters a token.
  assert(SYSTEM_PROMPT.length >= 3600, `only ${SYSTEM_PROMPT.length} characters`);
});

Deno.test("the system prompt holds no date, no id and no per-person value", () => {
  assertEquals(/\d{4}-\d{2}-\d{2}/.test(SYSTEM_PROMPT), false);
  assertEquals(/\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(SYSTEM_PROMPT), false);
  assertEquals(
    /\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(SYSTEM_PROMPT),
    false,
  );
  assertEquals(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(SYSTEM_PROMPT), false);
  assertEquals(/user[_ ]?id|@|\$\{/i.test(SYSTEM_PROMPT), false);
});

Deno.test("the system prompt follows the prose rules and never says I", () => {
  assertEquals(SYSTEM_PROMPT.includes("—"), false);
  assertEquals(SYSTEM_PROMPT.includes("--"), false);
  assertEquals(SYSTEM_PROMPT.includes(";"), false);
  assertEquals(/\bI(?:'[a-z]+)?\b/.test(SYSTEM_PROMPT), false);
  assertEquals(SYSTEM_PROMPT.includes("Ki-Lo"), true);
});

Deno.test("the system prompt holds the product rules the boards print", () => {
  for (const rule of [
    "<untrusted_data>",
    "never an instruction",
    "ask_user",
    "2 large eggs (100 g)",
    "150 g rice",
    "at 13:00",
    "fist",
    "semi skimmed milk",
    "citation",
    "deletes more than one entry",
    "copies a day over a day that already has entries",
    "archives a recipe",
    "changes targets",
    "never from multiplying",
    "log those grams",
    "do not convert them to a portion",
    "yesterday or last Tuesday",
    "tool_not_allowed",
    "say what they would like to change",
  ]) {
    assert(SYSTEM_PROMPT.includes(rule), `the system prompt does not hold: ${rule}`);
  }
});

Deno.test("the system prompt gives no example of a reply that repeats the card", () => {
  assertEquals(SYSTEM_PROMPT.includes("Logged 2 large eggs"), false);
});

Deno.test("the context block says today, the day being looked at and the Describe hour", () => {
  assertEquals(
    contextBlock({
      now: "2026-10-23T23:30:00Z",
      timeZone: "Europe/London",
      localDate: "2026-10-23",
      localTime: "13:00",
    }),
    {
      type: "text",
      text:
        "Today is Sat 24 Oct (2026-10-24) in Europe/London.\n" +
        "The user is looking at Fri 23 Oct (2026-10-23).\n" +
        "Log at 13:00 when no time is given.",
    },
  );
});

Deno.test("the context block leaves out the hour line when there is no Describe hour", () => {
  assertEquals(
    contextBlock({
      now: "2026-10-23T12:00:00Z",
      timeZone: "Europe/London",
      localDate: "2026-10-23",
      localTime: null,
    }),
    {
      type: "text",
      text:
        "Today is Fri 23 Oct (2026-10-23) in Europe/London.\n" +
        "The user is looking at Fri 23 Oct (2026-10-23).",
    },
  );
});

Deno.test(
  "the context block prints UTC when the profile zone is not valid, as the date was worked out in UTC",
  () => {
    assertEquals(
      contextBlock({
        now: "2026-10-23T23:30:00Z",
        timeZone: "Not/AZone",
        localDate: "2026-10-23",
        localTime: null,
      }).text,
      "Today is Fri 23 Oct (2026-10-23) in UTC.\nThe user is looking at Fri 23 Oct (2026-10-23).",
    );
  },
);

Deno.test("no open tool use after a complete round", () => {
  const history = [
    userText("how much protein today?"),
    stored("assistant", [toolUse("call-1", "get_day")]),
    stored("user", [toolResult("call-1")]),
    stored("assistant", [{ type: "text", text: "74 g" }]),
  ];

  assertEquals(openToolUses(history), []);
  assertEquals(openToolUses([]), []);
});

Deno.test("an ask_user left open by the last turn is found", () => {
  const history = [
    userText("log some rice"),
    stored("assistant", [{ type: "text", text: "Which size?" }, toolUse("call-1", "ask_user")]),
  ];

  assertEquals(openToolUses(history), [{ id: "call-1", name: "ask_user" }]);
});

Deno.test(
  "a call the last turn never ran is found, and the ones that have a result are not",
  () => {
    const history = [
      userText("delete Monday and Tuesday"),
      stored("assistant", [toolUse("call-1", "get_day"), toolUse("call-2", "delete_entries")]),
      stored("user", [toolResult("call-1")]),
    ];

    assertEquals(openToolUses(history), [{ id: "call-2", name: "delete_entries" }]);
  },
);

Deno.test("only the last assistant message can have an open tool use", () => {
  const history = [
    userText("log eggs"),
    stored("assistant", [toolUse("call-1", "ask_user")]),
    userText("two", "turn-2"),
    stored("assistant", [{ type: "text", text: "Logged." }], "turn-2"),
  ];

  assertEquals(openToolUses(history), []);
});

Deno.test(
  "the new user message answers an open ask_user in plain text and any other call as an error",
  () => {
    const blocks = userContent({
      openToolUses: [
        { id: "call-1", name: "ask_user" },
        { id: "call-2", name: "delete_entries" },
      ],
      context,
      text: "two eggs",
    });

    assertEquals(blocks.length, 4);
    const [asked, notRun] = blocks;
    assertEquals(asked, {
      type: "tool_result",
      tool_use_id: "call-1",
      content: "The answer is the person's message that follows.",
    });
    assertEquals(notRun, {
      type: "tool_result",
      tool_use_id: "call-2",
      is_error: true,
      content:
        "No result was recorded for this call because the turn ended. Check the diary before repeating it.",
    });
  },
);

Deno.test("the new user message puts the results first, then the context, then the words", () => {
  const blocks = userContent({
    openToolUses: [{ id: "call-1", name: "ask_user" }],
    context,
    text: "two eggs",
  });

  assertEquals(
    blocks.map((block) => block.type),
    ["tool_result", "text", "text"],
  );
  assertEquals(blocks.at(1), context);
  assertEquals(blocks.at(-1), { type: "text", text: "two eggs" });
});

Deno.test("without open calls the new user message is the context and the words", () => {
  assertEquals(userContent({ openToolUses: [], context, text: "hi" }), [
    context,
    { type: "text", text: "hi" },
  ]);
});

Deno.test(
  "the thread reader finds the person's words last, after the results and the context",
  () => {
    const history = [
      stored("user", userContent({ openToolUses: [], context, text: "log some rice" })),
      stored("assistant", [toolUse("call-1", "ask_user")]),
      stored(
        "user",
        userContent({
          openToolUses: [{ id: "call-1", name: "ask_user" }],
          context,
          text: "150 g",
        }),
        "turn-2",
      ),
    ];

    const users = threadFromMessages(
      history.map((message) => ({ ...message, turnStatus: "complete" as const })),
      [],
    ).flatMap((item) => (item.kind === "user" ? [item.text] : []));

    assertEquals(users, ["log some rice", "150 g"]);
  },
);

Deno.test("a stored tool_result message and the next user message become one message", () => {
  const history = [
    userText("delete Monday and Tuesday"),
    stored("assistant", [toolUse("call-1", "delete_entries")]),
    stored("user", [toolResult("call-1")]),
    userText("yes", "turn-2"),
  ];

  const messages = toApiMessages(history);

  assertEquals(
    messages.map((message) => message.role),
    ["user", "assistant", "user"],
  );
  const joined = messages.at(-1)?.content;
  assert(Array.isArray(joined));
  assertEquals(
    joined.map((block) => block.type),
    ["tool_result", "text", "text"],
  );
  assertEquals(joined.at(-1), { type: "text", text: "yes" });
});

Deno.test(
  "roles alternate in every replay of a conversation that ends in a confirm and a clarify",
  () => {
    const history = [
      userText("log some rice"),
      stored("assistant", [toolUse("call-1", "ask_user")]),
      stored(
        "user",
        userContent({ openToolUses: [{ id: "call-1", name: "ask_user" }], context, text: "150 g" }),
        "turn-2",
      ),
      stored("assistant", [toolUse("call-2", "delete_entries")], "turn-2"),
      stored("user", [toolResult("call-2")], "turn-2"),
      userText("yes", "turn-3"),
    ];

    for (let length = 1; length <= history.length; length += 1) {
      const roles = toApiMessages(history.slice(0, length)).map((message) => message.role);
      roles.forEach((role, index) => assertEquals(role, index % 2 === 0 ? "user" : "assistant"));
    }
  },
);

Deno.test("two calls on the same rows serialise to the same bytes", () => {
  const history = [
    userText("hi"),
    stored("assistant", [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "Hello" },
    ]),
    userText("log eggs", "turn-2"),
  ];

  assertEquals(JSON.stringify(toApiMessages(history)), JSON.stringify(toApiMessages(history)));
});

Deno.test("the app's display data is never sent, and thinking blocks go back unchanged", () => {
  const thinking: Anthropic.ThinkingBlockParam = {
    type: "thinking",
    thinking: "",
    signature: "sig-1",
  };
  const history = [
    { ...userText("hi"), display: { "call-1": { card: { kind: "logged" } } } },
    { ...stored("assistant", [thinking, toolUse("call-1", "get_day")]), display: null },
  ];

  const sent = JSON.stringify(toApiMessages(history));

  assertEquals(sent.includes("display"), false);
  assertEquals(sent.includes("card"), false);
  assertEquals(toApiMessages(history).at(-1)?.content?.[0], thinking);
});

Deno.test("a string content becomes a text block when messages are joined", () => {
  const messages = toApiMessages([stored("user", [toolResult("call-1")]), stored("user", "hello")]);

  assertEquals(messages.length, 1);
  assertEquals(messages[0]?.content, [toolResult("call-1"), { type: "text", text: "hello" }]);
});

Deno.test(
  "a stored message that is not a Messages API message is refused without quoting it",
  () => {
    const error = assertThrows(
      () => toApiMessages([stored("user", [{ type: "text", text: 42, secret: "76.4 kg" }])]),
      StoredMessageError,
    );

    assertEquals(error.message.includes("76.4"), false);
    assertThrows(() => toApiMessages([stored("assistant", { not: "blocks" })]), StoredMessageError);
  },
);

Deno.test(
  "the request names the model, adaptive thinking, the effort and automatic tool choice",
  () => {
    const request = buildTurnRequest({ tools, messages: toApiMessages([userText("hi")]) });

    assertEquals(request.model, "claude-haiku-5-5");
    assertEquals(request.thinking, { type: "adaptive" });
    assertEquals(request.output_config, { effort: "medium" });
    assertEquals(request.tool_choice, { type: "auto" });
    assertEquals(request.max_tokens, 8000);
  },
);

Deno.test("the last message of the request has the user role", () => {
  const request = buildTurnRequest({
    tools,
    messages: toApiMessages([
      userText("log eggs"),
      stored("assistant", [{ type: "text", text: "Logged." }]),
      userText("and toast", "turn-2"),
    ]),
  });

  assertEquals(request.messages.at(-1)?.role, "user");
});

Deno.test("a tool whose input schema is not an object schema is refused with its own words", () => {
  const error = assertThrows(
    () =>
      buildTurnRequest({
        tools: [
          {
            name: "shaped",
            description: "A shaped tool.",
            input_schema: { properties: {} },
            strict: true,
            eager_input_streaming: true,
          },
        ],
        messages: [],
      }),
    Error,
    "shaped",
  );

  assertEquals(error.message.includes("additionalProperties"), false);
  assertEquals(error.message.includes("not an object schema"), true);
});

Deno.test("the tools are sent exactly as the adapter gave them", () => {
  const request = buildTurnRequest({ tools, messages: toApiMessages([userText("hi")]) });

  assertEquals(JSON.stringify(request.tools), JSON.stringify(tools));
});

Deno.test(
  "turn one and turn two send the same system and tools, and turn one's messages are a prefix",
  () => {
    const turnOne = [userText("log eggs")];
    const turnTwo = [
      ...turnOne,
      stored("assistant", [{ type: "text", text: "Logged." }]),
      userText("and toast", "turn-2"),
    ];

    const first = buildTurnRequest({ tools, messages: toApiMessages(turnOne) });
    const second = buildTurnRequest({ tools, messages: toApiMessages(turnTwo) });

    assertEquals(JSON.stringify(first.system), JSON.stringify(second.system));
    assertEquals(JSON.stringify(first.tools), JSON.stringify(second.tools));
    const firstMessages = withoutBreakpoints(first.messages);
    assert(Array.isArray(firstMessages));
    assertEquals(
      JSON.stringify(withoutBreakpoints(second.messages)).startsWith(
        JSON.stringify(firstMessages).slice(0, -1),
      ),
      true,
    );
  },
);

Deno.test("only the system block and the last block of the last message carry a breakpoint", () => {
  const messages = toApiMessages([
    userText("log eggs"),
    stored("assistant", [{ type: "text", text: "Logged." }]),
    userText("and toast", "turn-2"),
  ]);

  const request = buildTurnRequest({ tools, messages });

  const body = JSON.stringify(request);
  assertEquals(body.split('"cache_control"').length - 1, 2);
  const system = request.system;
  assert(Array.isArray(system));
  assertEquals(system[0]?.cache_control, { type: "ephemeral" });
  const last = request.messages.at(-1)?.content;
  assert(Array.isArray(last));
  const lastBlock = last.at(-1);
  assert(lastBlock !== undefined && "cache_control" in lastBlock);
  assertEquals(lastBlock.cache_control, { type: "ephemeral" });
  assertEquals(
    last.slice(0, -1).some((block) => "cache_control" in block),
    false,
  );
});

Deno.test("the breakpoint is put on a copy, so the stored content never carries it", () => {
  const messages = toApiMessages([userText("log eggs")]);
  const before = JSON.stringify(messages);

  buildTurnRequest({ tools, messages });

  assertEquals(JSON.stringify(messages), before);
  assertEquals(before.includes("cache_control"), false);
});

Deno.test("a last message with string content still gets its breakpoint, on a text block", () => {
  const request = buildTurnRequest({ tools, messages: [{ role: "user", content: "hi" }] });

  assertEquals(request.messages.at(-1)?.content, [
    { type: "text", text: "hi", cache_control: { type: "ephemeral" } },
  ]);
});

Deno.test("no forbidden key or value appears anywhere in the serialised request", () => {
  const messages = toApiMessages([
    userText("log eggs"),
    stored("assistant", [toolUse("call-1", "get_day")]),
    stored("user", [toolResult("call-1")]),
  ]);

  const request = buildTurnRequest({ tools, messages });

  const forbiddenKeys = [
    "temperature",
    "top_p",
    "top_k",
    "budget_tokens",
    "fallbacks",
    "mcp_servers",
    "betas",
    "metadata",
    "user_id",
    "service_tier",
    "stop_sequences",
  ];
  const keys = new Set(keysOf(JSON.parse(JSON.stringify(request))));
  for (const key of forbiddenKeys) {
    assertEquals(keys.has(key), false, `the request holds the key ${key}`);
  }
  const body = JSON.stringify(request);
  assertEquals(body.includes("mcp_toolset"), false);
  assertEquals(body.includes("mcp-client-2025-11-20"), false);
  assertEquals(body.includes('tool_choice":{"type":"any'), false);
});

Deno.test("the request builder takes no user id, email or profile field", () => {
  const request: Anthropic.MessageStreamParams = buildTurnRequest({
    tools,
    messages: [],
    // @ts-expect-error the parameters name tools and messages and nothing about the person
    userId: "00000000-0000-4000-8000-0000000000a1",
  });

  assertEquals(JSON.stringify(request).includes("0000a1"), false);
});
