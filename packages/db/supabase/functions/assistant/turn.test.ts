import { assert, assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";

import { toolRegistry } from "../_shared/assistant/registry.ts";
import { spyOnConsole } from "../_shared/assistant/testing.ts";
import { toJsonSchema } from "../_shared/assistant/tool.ts";
import { confirmDeleteButtons, threadFromMessages } from "../_shared/core.ts";
import { contextBlock, MODEL } from "./prompt.ts";
import {
  MCP_REQUEST_TIMEOUT_MILLISECONDS,
  MODEL_REQUEST_TIMEOUT_MILLISECONDS,
  createModelClient,
} from "./turn.ts";
import {
  confirmationResult,
  createHarness,
  errorResult,
  failingCall,
  fakeTools,
  jwt,
  listed,
  okResult,
  userEmail,
  userId,
} from "./turnTesting.ts";

import type { ListedTool } from "../_shared/assistant/mcpClient.ts";
import type { AssistantStreamEvent } from "../_shared/core.ts";
import type { Harness, HarnessOptions, ScriptedResponse, ToolAnswer } from "./turnTesting.ts";

const reply = (text: string): ScriptedResponse => ({
  blocks: [{ type: "text", text }],
  stopReason: "end_turn",
});

const callTools = (
  calls: { id: string; name: string; input?: unknown; rawJson?: string }[],
  text?: string,
): ScriptedResponse => ({
  blocks: [
    ...(text === undefined ? [] : [{ type: "text" as const, text }]),
    ...calls.map((call) => ({ type: "tool_use" as const, ...call })),
  ],
  stopReason: "tool_use",
});

async function withHarness(options: HarnessOptions, body: (harness: Harness) => Promise<void>) {
  const harness = await createHarness(options);
  try {
    await body(harness);
  } finally {
    await harness.shutdown();
  }
}

function eventsOfType<Type extends AssistantStreamEvent["type"]>(
  events: readonly AssistantStreamEvent[],
  type: Type,
) {
  return events.filter(
    (event): event is Extract<AssistantStreamEvent, { type: Type }> => event.type === type,
  );
}

const typesOf = (events: readonly AssistantStreamEvent[]) => events.map((event) => event.type);
const textOf = (events: readonly AssistantStreamEvent[]) =>
  eventsOfType(events, "text")
    .map((event) => event.delta)
    .join("");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The blocks of a stored message.
function blocksOf(content: unknown): Record<string, unknown>[] {
  return Array.isArray(content) ? content.filter(isRecord) : [];
}

// The stored messages of one role.
const rowsOfRole = (harness: Harness, role: "user" | "assistant") =>
  harness.rows().filter((row) => row.role === role);

const toolResultRows = (harness: Harness) =>
  harness.rows().filter((row) => blocksOf(row.content).some((b) => b["type"] === "tool_result"));

const turnStatuses = (harness: Harness) => harness.turnRows().map((turn) => turn["status"]);

const cardDraft = (name: string, kcal: number) => ({
  kind: "logged",
  title: `Logged ${name} at 08:10`,
  sub: null,
  rows: [
    {
      name,
      amountText: `1 ${name} (50 g)`,
      time: "08:10",
      kcalText: `${kcal} kcal`,
      match: null,
      matchedFood: null,
      estimate: false,
    },
  ],
  totalText: `${kcal} kcal · P 10 g · C 5 g · F 4 g`,
  note: null,
  link: null,
  undo: "available",
  undoneSub: `Removed ${name} from 08:10`,
});

const actionA = "00000000-0000-4000-8000-0000000000a5";
const actionB = "00000000-0000-4000-8000-0000000000a6";
const confirmationId = "00000000-0000-4000-8000-0000000000c9";
const entryIds = [
  "00000000-0000-4000-8000-0000000000e1",
  "00000000-0000-4000-8000-0000000000e2",
  "00000000-0000-4000-8000-0000000000e3",
];

// Answers the nth call with the nth result.
const inSequence =
  (...results: ToolAnswer[]): ToolAnswer =>
  (input) => {
    const next = results.shift();
    if (next === undefined) {
      throw new Error("no more scripted results");
    }
    return typeof next === "function" ? next(input) : next;
  };

const loggedCall = (action: string, name: string, kcal: number) =>
  okResult({ name: "log_entry", structured: { card: cardDraft(name, kcal) }, actionId: action });

// ---- Text, cards, usage ----

Deno.test(
  "a text-only reply streams turn, the text and done complete, and stores the turn once",
  async () => {
    await withHarness({ responses: [reply("Hello there, friend")] }, async (harness) => {
      const result = await harness.take("Hi");

      assertEquals(typesOf(result.events)[0], "turn");
      assertEquals(textOf(result.events), "Hello there, friend");
      assert(eventsOfType(result.events, "text").length > 1);
      assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
      assertEquals(typesOf(result.events).includes("answer_meta"), false);
      // The user message was replaced once with the context and the words, in the order the API accepts.
      const [userRow, assistantRow] = result.rows;
      assertEquals(userRow?.content, [
        contextBlock({
          now: "2026-11-03T12:00:00.000Z",
          timeZone: "Europe/London",
          localDate: "2026-11-03",
          localTime: null,
        }),
        { type: "text", text: "Hi" },
      ]);
      assertEquals(assistantRow?.content, [{ type: "text", text: "Hello there, friend" }]);
      assertEquals(result.rows.length, 2);
      assertEquals(turnStatuses(harness), ["complete"]);
      assertEquals(
        harness.connections.map((connection) => connection.closeCount),
        [1],
      );
    });
  },
);

Deno.test(
  "each model call writes one usage row of counts, priced by the requested model",
  async () => {
    await withHarness(
      {
        responses: [
          {
            ...callTools([{ id: "t1", name: "search_foods", input: { query: "egg" } }]),
            usage: { input: 200, output: 30 },
          },
          {
            ...callTools([{ id: "t2", name: "get_day", input: { local_date: "2026-11-03" } }]),
            usage: { cacheRead: 150, cacheCreation: 40 },
          },
          reply("Done"),
        ],
      },
      async (harness) => {
        await harness.take("What did I log today?");

        const rows = harness.usageRows();
        assertEquals(rows.length, 3);
        for (const row of rows) {
          assertEquals(row["model"], MODEL);
          assertEquals(row["user_id"], userId);
          assertEquals(row["route"], "describe_or_ask");
          assertEquals(typeof row["latency_ms"], "number");
        }
        assertEquals(rows[0]?.["input_tokens"], 200);
        assertEquals(rows[0]?.["output_tokens"], 30);
        assertEquals(rows[0]?.["stop_reason"], "tool_use");
        assertEquals(rows[1]?.["cache_read_input_tokens"], 150);
        assertEquals(rows[1]?.["cache_creation_input_tokens"], 40);
        assertEquals(rows[2]?.["stop_reason"], "end_turn");
        // Ids and counts only: no column holds text.
        const columns = Object.keys(rows[0] ?? {}).filter(
          (name) => name !== "id" && name !== "created_at",
        );
        assertEquals(columns.sort(), [
          "cache_creation_input_tokens",
          "cache_read_input_tokens",
          "cost_usd_micros",
          "input_tokens",
          "latency_ms",
          "model",
          "output_tokens",
          "route",
          "stop_reason",
          "transport",
          "turn_id",
          "user_id",
        ]);
      },
    );
  },
);

Deno.test(
  "a write gives a card event, and its tool_result is stored as sent with the display keyed by tool_use_id",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "t1", name: "log_entry", input: { food_id: "f1" } }], "Logging that."),
          reply("Logged."),
        ],
        answers: { log_entry: loggedCall(actionA, "egg", 143) },
      },
      async (harness) => {
        const result = await harness.take("log an egg");

        assertEquals(
          typesOf(result.events).filter((type) => type !== "text"),
          ["turn", "card", "done"],
        );
        const [card] = eventsOfType(result.events, "card");
        assertEquals(card?.card.actionIds, [actionA]);
        assertEquals(card?.card.title, "Logged egg at 08:10");
        // The card comes before the reply that follows it.
        assert(
          harness.written.join("").indexOf('"type":"card"') <
            harness.written.join("").indexOf("Logged."),
        );
        const [toolRow] = toolResultRows(harness);
        const [block] = blocksOf(toolRow?.content);
        assertEquals(block?.["type"], "tool_result");
        assertEquals(block?.["tool_use_id"], "t1");
        assertEquals(Object.hasOwn(block ?? {}, "is_error"), false);
        assertStringIncludes(String(block?.["content"]), "<untrusted_data");
        assertEquals(toolRow?.display, {
          t1: { card: { actionIds: [actionA], ...cardDraft("egg", 143) } },
        });
        assertEquals(toolRow?.role, "user");
      },
    );
  },
);

Deno.test(
  "two log_entry results in one turn give one card with two action ids, in one response or two",
  async () => {
    for (const responses of [
      [
        callTools([
          { id: "t1", name: "log_entry", input: { food_id: "f1" } },
          { id: "t2", name: "log_entry", input: { food_id: "f2" } },
        ]),
        reply("Done."),
      ],
      [
        callTools([{ id: "t1", name: "log_entry", input: { food_id: "f1" } }]),
        callTools([{ id: "t2", name: "log_entry", input: { food_id: "f2" } }]),
        reply("Done."),
      ],
    ]) {
      await withHarness(
        {
          responses,
          answers: {
            log_entry: inSequence(
              loggedCall(actionA, "eggs", 143),
              loggedCall(actionB, "toast", 89),
            ),
          },
        },
        async (harness) => {
          const result = await harness.take("eggs and toast");

          const cards = eventsOfType(result.events, "card");
          assertEquals(cards.length, 1);
          assertEquals(cards[0]?.card.actionIds, [actionA, actionB]);
          assertEquals(cards[0]?.card.title, "Logged eggs and toast at 08:10");
          // Each call keeps its own card in the display, as the thread merges again on reopen.
          const displays = toolResultRows(harness).map((row) => row.display);
          assertEquals(displays.length, 2);
        },
      );
    }
  },
);

// ---- Parity with threadFromMessages ----

const actionStates = [actionA, actionB].map((id) => ({
  id,
  hasTarget: true,
  undoneAt: null,
  targetUpdatedAt: null,
  targets: null,
}));

Deno.test("parity: two writes give the thread the same card as the live event", async () => {
  await withHarness(
    {
      responses: [
        callTools([
          { id: "t1", name: "log_entry", input: { food_id: "f1" } },
          { id: "t2", name: "log_entry", input: { food_id: "f2" } },
        ]),
        reply("Done."),
      ],
      answers: {
        log_entry: inSequence(loggedCall(actionA, "eggs", 143), loggedCall(actionB, "toast", 89)),
      },
    },
    async (harness) => {
      const result = await harness.take("eggs and toast");

      const thread = threadFromMessages(result.rows, actionStates);

      const liveCards = eventsOfType(result.events, "card").map((event) => event.card);
      const threadCards = thread.flatMap((item) => (item.kind === "card" ? [item.card] : []));
      assertEquals(threadCards, liveCards);
    },
  );
});

Deno.test(
  "parity: two diary reads give the thread the same answer meta as the live event",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([
            { id: "g1", name: "get_day", input: { local_date: "2026-11-02" } },
            { id: "g2", name: "get_entries", input: { local_date: "2026-11-03" } },
          ]),
          reply("You ate well. Based on 99 entries, never."),
        ],
        answers: {
          get_day: okResult({
            structured: { citation: "Based on 3 entries, 2 Nov", estimate: null },
          }),
          get_entries: okResult({
            structured: {
              citation: "Based on 5 entries, 3 Nov",
              estimate: "Trend weight is an estimate",
            },
          }),
        },
      },
      async (harness) => {
        const result = await harness.take("How did I eat on Monday and Tuesday?");

        const metas = eventsOfType(result.events, "answer_meta");
        assertEquals(metas, [
          {
            type: "answer_meta",
            citation: "Based on 3 entries, 2 Nov · Based on 5 entries, 3 Nov",
            estimate: "Trend weight is an estimate",
          },
        ]);
        assertEquals(typesOf(result.events).slice(-2), ["answer_meta", "done"]);
        const reply = threadFromMessages(result.rows, []).find((item) => item.kind === "reply");
        assertEquals(reply?.kind === "reply" ? reply.answerMeta : "no reply", {
          citation: metas[0]?.citation,
          estimate: metas[0]?.estimate,
        });
      },
    );
  },
);

Deno.test(
  "parity: a clarify and a confirm read back from the thread as they streamed",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([
            {
              id: "a1",
              name: "ask_user",
              input: { question: "How much rice?", quick_replies: ["100 g", "150 g"] },
            },
          ]),
          callTools(
            [{ id: "d1", name: "delete_entry", input: { ids: entryIds } }],
            "Delete 3 entries at 13:00 today?",
          ),
        ],
        answers: { delete_entry: confirmationResult("delete_entry", confirmationId) },
      },
      async (harness) => {
        const first = await harness.take("log rice");
        const second = await harness.take("delete my lunch");

        const thread = threadFromMessages(second.rows, []);

        const [clarify] = eventsOfType(first.events, "clarify");
        const clarifyItem = thread.find((item) => item.kind === "clarify");
        assertEquals(
          clarifyItem?.kind === "clarify" ? clarifyItem.question : null,
          clarify?.question,
        );
        assertEquals(
          clarifyItem?.kind === "clarify" ? clarifyItem.quickReplies : null,
          clarify?.quickReplies,
        );
        assertEquals(
          clarifyItem?.kind === "clarify" ? clarifyItem.fieldHint : null,
          clarify?.fieldHint,
        );
        const [confirm] = eventsOfType(second.events, "confirm");
        const confirmItem = thread.find((item) => item.kind === "confirm");
        assertEquals(
          confirmItem?.kind === "confirm"
            ? {
                confirmationId: confirmItem.confirmationId,
                question: confirmItem.question,
                confirmLabel: confirmItem.confirmLabel,
                cancelLabel: confirmItem.cancelLabel,
                tone: confirmItem.tone,
              }
            : null,
          {
            confirmationId: confirm?.confirmationId,
            question: confirm?.question,
            confirmLabel: confirm?.confirmLabel,
            cancelLabel: confirm?.cancelLabel,
            tone: confirm?.tone,
          },
        );
      },
    );
  },
);

// ---- Confirm and clarify ----

Deno.test(
  "needs_confirmation gives confirm with the response's text, delete_entry's buttons and danger, and no further model call",
  async () => {
    await withHarness(
      {
        responses: [
          callTools(
            [
              { id: "d1", name: "delete_entry", input: { ids: entryIds } },
              { id: "s1", name: "search_foods", input: { query: "egg" } },
            ],
            "Delete 3 entries at 13:00 today?",
          ),
          reply("must not be asked for"),
        ],
        answers: { delete_entry: confirmationResult("delete_entry", confirmationId) },
      },
      async (harness) => {
        const result = await harness.take("delete my lunch");

        assertEquals(eventsOfType(result.events, "confirm"), [
          {
            type: "confirm",
            confirmationId,
            question: "Delete 3 entries at 13:00 today?",
            ...confirmDeleteButtons(3),
            tone: "danger",
          },
        ]);
        assertEquals(result.events.at(-1), { type: "done", outcome: "confirm" });
        // Nothing is written after the confirm but the done, and no answer meta.
        assertEquals(
          typesOf(result.events).filter((type) => type !== "text"),
          ["turn", "confirm", "done"],
        );
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(
          harness.connections[0]?.calls.map((call) => call.name),
          ["delete_entry"],
        );
        assertEquals(turnStatuses(harness), ["confirm"]);
        assertEquals(harness.connections[0]?.closeCount, 1);
        const [toolRow] = toolResultRows(harness);
        assertEquals(toolRow?.display, {
          d1: {
            confirm: {
              confirmationId,
              question: "Delete 3 entries at 13:00 today?",
              ...confirmDeleteButtons(3),
              tone: "danger",
            },
          },
        });
      },
    );
  },
);

Deno.test(
  "a confirmation with no words for its tool, or no question text, ends the turn failed and reports",
  async () => {
    for (const [name, text] of [
      ["log_entry", "Are you sure?"],
      ["delete_entry", undefined],
    ] as const) {
      await withHarness(
        {
          responses: [
            callTools([{ id: "c1", name, input: { ids: entryIds, food_id: "f" } }], text),
          ],
          answers: { [name]: confirmationResult(name, confirmationId) },
        },
        async (harness) => {
          const result = await harness.take("log it please");

          assertEquals(typesOf(result.events).includes("confirm"), false);
          assertEquals(result.events.slice(-2), [
            { type: "notice", notice: { code: "turn_failed" } },
            { type: "done", outcome: "failed" },
          ]);
          assertEquals(turnStatuses(harness), ["failed"]);
          assertEquals(harness.reports.length, 1);
          assertEquals(harness.mock.bodies.length, 1);
        },
      );
    }
  },
);

Deno.test(
  "ask_user gives clarify, is never sent to the server, and the next turn opens with its tool_result",
  async () => {
    await withHarness(
      {
        responses: [
          callTools(
            [
              {
                id: "a1",
                name: "ask_user",
                input: { question: "How much rice?", quick_replies: ["100 g", "150 g"] },
              },
              { id: "s1", name: "search_foods", input: { query: "rice" } },
            ],
            "One moment.",
          ),
          reply("Logged 150 g rice."),
        ],
      },
      async (harness) => {
        const first = await harness.take("log rice");

        assertEquals(eventsOfType(first.events, "clarify"), [
          {
            type: "clarify",
            question: "How much rice?",
            quickReplies: ["100 g", "150 g"],
            fieldHint: "Or say it your way",
          },
        ]);
        assertEquals(first.events.at(-1), { type: "done", outcome: "clarify" });
        assertEquals(harness.connections[0]?.calls, []);
        assertEquals(turnStatuses(harness), ["clarify"]);
        assertEquals(harness.connections[0]?.closeCount, 1);

        await harness.take("150 g");

        const body = harness.mock.json()[1];
        const messages = Array.isArray(body?.["messages"]) ? body["messages"].filter(isRecord) : [];
        assertEquals(
          messages.map((message) => message["role"]),
          ["user", "assistant", "user"],
        );
        const [open, ...rest] = blocksOf(messages[2]?.["content"]);
        assertEquals(open?.["type"], "tool_result");
        assertEquals(open?.["tool_use_id"], "a1");
        // The second call of that response never ran, so it is answered as an error, not as a result.
        assertEquals(rest[0]?.["tool_use_id"], "s1");
        assertEquals(rest[0]?.["is_error"], true);
        assertEquals(blocksOf(messages[2]?.["content"]).at(-1)?.["text"], "150 g");
      },
    );
  },
);

Deno.test(
  "an ask_user input the schema refuses goes back as an error and the loop goes on",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([
            {
              id: "a1",
              name: "ask_user",
              input: { question: "?", quick_replies: ["1", "2", "3", "4"] },
            },
          ]),
          reply("Which food?"),
        ],
      },
      async (harness) => {
        const result = await harness.take("log rice");

        assertEquals(typesOf(result.events).includes("clarify"), false);
        assertEquals(harness.connections[0]?.calls, []);
        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        const [toolRow] = toolResultRows(harness);
        assertEquals(blocksOf(toolRow?.content)[0]?.["is_error"], true);
      },
    );
  },
);

// ---- Endings ----

Deno.test(
  "a refusal runs no tool, stores the message and ends refused with the failed-turn notice",
  async () => {
    await withHarness(
      {
        responses: [
          {
            blocks: [
              { type: "text", text: "I cannot help with that." },
              { type: "tool_use", id: "t1", name: "log_entry", input: { food_id: "f" } },
            ],
            stopReason: "refusal",
          },
        ],
      },
      async (harness) => {
        const result = await harness.take("something");

        assertEquals(harness.connections[0]?.calls, []);
        assertEquals(result.events.slice(-2), [
          { type: "notice", notice: { code: "turn_failed" } },
          { type: "done", outcome: "failed" },
        ]);
        assertEquals(turnStatuses(harness), ["refused"]);
        assertEquals(rowsOfRole(harness, "assistant").length, 1);
        // A refusal can cut a call off mid-input, so the call is not stored.
        assertEquals(
          blocksOf(rowsOfRole(harness, "assistant")[0]?.content).map((block) => block["type"]),
          ["text"],
        );
        assertEquals(harness.connections[0]?.closeCount, 1);
      },
    );
  },
);

Deno.test(
  "a tool_use under max_tokens is not run and the turn ends failed, and a reply cut off ends complete",
  async () => {
    await withHarness(
      {
        responses: [
          {
            blocks: [{ type: "tool_use", id: "t1", name: "log_entry", input: { food_id: "f" } }],
            stopReason: "max_tokens",
          },
        ],
      },
      async (harness) => {
        const result = await harness.take("log it");

        assertEquals(harness.connections[0]?.calls, []);
        assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
        assertEquals(turnStatuses(harness), ["failed"]);
        // A cut-off call is never stored, and there was nothing else to store.
        assertEquals(rowsOfRole(harness, "assistant").length, 0);
      },
    );
    await withHarness(
      {
        responses: [
          { blocks: [{ type: "text", text: "A long reply that" }], stopReason: "max_tokens" },
        ],
      },
      async (harness) => {
        const result = await harness.take("tell me");

        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        assertEquals(turnStatuses(harness), ["complete"]);
      },
    );
  },
);

Deno.test("pause_turn ends the turn failed with a report", async () => {
  await withHarness(
    { responses: [{ blocks: [{ type: "text", text: "x" }], stopReason: "pause_turn" }] },
    async (harness) => {
      const result = await harness.take("hi");

      assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
      assertEquals(turnStatuses(harness), ["failed"]);
      assertEquals(harness.reports.length, 1);
    },
  );
});

// ---- Tool results and checks ----

Deno.test(
  "an isError result, and an unknown_tool one, go back as is_error and the loop goes on",
  async () => {
    const tools: ListedTool[] = [...fakeTools, listed("mystery", true)];
    await withHarness(
      {
        tools,
        responses: [
          callTools([
            { id: "s1", name: "search_foods", input: { query: "egg" } },
            { id: "m1", name: "mystery", input: {} },
          ]),
          reply("That did not work."),
        ],
        answers: {
          search_foods: errorResult("search_foods", "tool_failed"),
          mystery: errorResult("mystery", "unknown_tool"),
        },
      },
      async (harness) => {
        const result = await harness.take("find an egg");

        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        const results = toolResultRows(harness).flatMap((row) => blocksOf(row.content));
        assertEquals(
          results.map((block) => [block["tool_use_id"], block["is_error"]]),
          [
            ["s1", true],
            ["m1", true],
          ],
        );
        assertStringIncludes(String(results[1]?.["content"]), "unknown_tool");
        assertEquals(harness.mock.bodies.length, 2);
      },
    );
  },
);

Deno.test(
  "on a recipe-import turn a delete_entry call is never sent and the model gets tool_not_allowed",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }]),
          reply("I cannot delete."),
        ],
      },
      async (harness) => {
        await harness.take("Add this https://example.com/pasta/recipe please");

        assertEquals(harness.connections[0]?.calls, []);
        assertEquals(harness.connectOptions[0]?.allowedTools.includes("delete_entry"), false);
        const [block] = blocksOf(toolResultRows(harness)[0]?.content);
        assertEquals(block?.["is_error"], true);
        assertStringIncludes(String(block?.["content"]), "tool_not_allowed");
        assertStringIncludes(String(block?.["content"]), '<untrusted_data source="delete_entry">');
      },
    );
  },
);

Deno.test(
  "an input that is not a JSON object is never sent and goes back as an error",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "s1", name: "search_foods", rawJson: "[1, 2]" }]),
          reply("Sorry."),
        ],
      },
      async (harness) => {
        await harness.take("find an egg");

        assertEquals(harness.connections[0]?.calls, []);
        const [block] = blocksOf(toolResultRows(harness)[0]?.content);
        assertEquals(block?.["is_error"], true);
        assertStringIncludes(String(block?.["content"]), "INVALID_JSON");
      },
    );
  },
);

Deno.test(
  "a failed write call is not repeated and the turn ends failed with the client closed",
  async () => {
    await withHarness(
      {
        responses: [callTools([{ id: "t1", name: "log_entry", input: { food_id: "f" } }])],
        answers: { log_entry: failingCall() },
      },
      async (harness) => {
        const result = await harness.take("log an egg");

        assertEquals(
          harness.connections[0]?.calls.map((call) => call.name),
          ["log_entry"],
        );
        assertEquals(result.events.slice(-2), [
          { type: "notice", notice: { code: "turn_failed" } },
          { type: "done", outcome: "failed" },
        ]);
        assertEquals(turnStatuses(harness), ["failed"]);
        assertEquals(harness.connections[0]?.closeCount, 1);
        assertEquals(harness.reports.length, 1);
        assertEquals(harness.mock.bodies.length, 1);
      },
    );
  },
);

Deno.test(
  "a model error ends the turn failed and still writes a usage row of zeros with no stop reason",
  async () => {
    await withHarness(
      { responses: [{ blocks: [], stopReason: "end_turn", httpStatus: 400 }] },
      async (harness) => {
        const result = await harness.take("hi");

        assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
        assertEquals(turnStatuses(harness), ["failed"]);
        const [row] = harness.usageRows();
        assertEquals(harness.usageRows().length, 1);
        assertEquals(row?.["stop_reason"], null);
        assertEquals(row?.["input_tokens"], 0);
        assertEquals(row?.["output_tokens"], 0);
        assertEquals(harness.reports.length, 1);
        assertEquals(harness.connections[0]?.closeCount, 1);
      },
    );
  },
);

Deno.test(
  "a tool input the SDK cannot parse at all re-issues the call, and an API error does not",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "s1", name: "search_foods", rawJson: '{"query" "egg"}' }]),
          reply("Found it."),
        ],
      },
      async (harness) => {
        const result = await harness.take("find an egg");

        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        assertEquals(harness.mock.bodies.length, 2);
        assertEquals(harness.usageRows().length, 2);
        assertEquals(harness.usageRows()[0]?.["stop_reason"], null);
        assertEquals(harness.connections[0]?.calls, []);
      },
    );
  },
);

Deno.test("no blank text block, empty content or empty string is ever stored", async () => {
  await withHarness(
    {
      responses: [
        {
          blocks: [
            { type: "thinking", thinking: "Let me look.", signature: "sig-1" },
            { type: "text", text: "  " },
            { type: "tool_use", id: "s1", name: "search_foods", input: { query: "egg" } },
          ],
          stopReason: "tool_use",
        },
        { blocks: [{ type: "text", text: "" }], stopReason: "end_turn" },
      ],
    },
    async (harness) => {
      const result = await harness.take("find an egg");

      assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
      const assistant = rowsOfRole(harness, "assistant");
      assertEquals(assistant.length, 1);
      // Thinking comes back exactly as it was returned, with its signature.
      assertEquals(assistant[0]?.content, [
        { type: "thinking", thinking: "Let me look.", signature: "sig-1" },
        { type: "tool_use", id: "s1", name: "search_foods", input: { query: "egg" } },
      ]);
      for (const row of result.rows) {
        assertNotEquals(row.content, "");
        assertNotEquals(row.content, []);
      }
    },
  );
});

Deno.test(
  "a finishTurn that throws is reported and does not turn a good ending into a failed one",
  async () => {
    await withHarness(
      {
        responses: [reply("Hi.")],
        wrapTurns: (turns) => ({
          ...turns,
          finishTurn: () => Promise.reject(new Error("the conversation bump failed")),
        }),
      },
      async (harness) => {
        const result = await harness.take("hi");

        assertEquals(
          result.events.filter((event) => event.type === "done"),
          [{ type: "done", outcome: "complete" }],
        );
        assertEquals(typesOf(result.events).includes("notice"), false);
        assertEquals(harness.reports.length, 1);
      },
    );
  },
);

// ---- Abort ----

Deno.test(
  "an abort mid-text stores the partial text as text blocks, ends stopped, writes no done and closes the client",
  async () => {
    await withHarness(
      {
        responses: [
          {
            blocks: [
              { type: "thinking", thinking: "hmm", signature: "sig" },
              { type: "text", text: "Let me think about that for you" },
            ],
            stopReason: "end_turn",
            holdAfterFirstText: true,
          },
        ],
      },
      async (harness) => {
        const run = harness.start("hello");
        await run.textReceived;
        await run.cancel();
        const result = await run.finished;

        assertEquals(typesOf(result.events).includes("done"), false);
        const [assistant] = rowsOfRole(harness, "assistant");
        const blocks = blocksOf(assistant?.content);
        assert(blocks.length > 0);
        assert(
          blocks.every((block) => block["type"] === "text" && String(block["text"]).trim() !== ""),
        );
        assertStringIncludes("Let me think about that for you", String(blocks[0]?.["text"]).trim());
        assertEquals(turnStatuses(harness), ["stopped"]);
        assertEquals(harness.connections[0]?.closeCount, 1);
        assertEquals(harness.usageRows().length, 1);
      },
    );
  },
);

Deno.test("the request's own signal also stops the turn", async () => {
  const controller = new AbortController();
  await withHarness(
    {
      responses: [
        {
          blocks: [{ type: "text", text: "Let me think" }],
          stopReason: "end_turn",
          holdAfterFirstText: true,
        },
      ],
    },
    async (harness) => {
      const run = harness.start("hello", {
        request: new Request("http://localhost/functions/v1/assistant/turn", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
          signal: controller.signal,
        }),
      });
      await run.textReceived;
      controller.abort();
      const result = await run.finished;

      assertEquals(typesOf(result.events).includes("done"), false);
      assertEquals(turnStatuses(harness), ["stopped"]);
      assertEquals(harness.connections[0]?.closeCount, 1);
    },
  );
});

Deno.test("an abort during a tool call stores that result and makes no further call", async () => {
  let run: ReturnType<Harness["start"]> | undefined;
  await withHarness(
    {
      responses: [
        callTools([
          { id: "s1", name: "search_foods", input: { query: "egg" } },
          { id: "g1", name: "get_day", input: { local_date: "2026-11-03" } },
        ]),
        reply("never asked for"),
      ],
      answers: {
        search_foods: async () => {
          await run?.cancel();
          return okResult({ name: "search_foods" });
        },
      },
    },
    async (harness) => {
      run = harness.start("find an egg");
      const result = await run.finished;

      assertEquals(
        harness.connections[0]?.calls.map((call) => call.name),
        ["search_foods"],
      );
      assertEquals(
        toolResultRows(harness)
          .flatMap((row) => blocksOf(row.content))
          .map((b) => b["tool_use_id"]),
        ["s1"],
      );
      assertEquals(harness.mock.bodies.length, 1);
      assertEquals(typesOf(result.events).includes("done"), false);
      assertEquals(turnStatuses(harness), ["stopped"]);
      assertEquals(harness.connections[0]?.closeCount, 1);
    },
  );
});

// ---- Connection and requests ----

Deno.test(
  "the tool list is read once for the function instance, and later turns hand it to the connection",
  async () => {
    await withHarness({ responses: [reply("One."), reply("Two.")] }, async (harness) => {
      await harness.take("first question");
      await harness.take("second question");

      assertEquals(harness.connections[0]?.log, ["listTools", "close"]);
      assertEquals(harness.connections[1]?.log, ["close"]);
      assertEquals(harness.connectOptions[0]?.knownTools, undefined);
      assertEquals(
        harness.connectOptions[1]?.knownTools?.map((tool) => tool.name),
        fakeTools.map((tool) => tool.name),
      );
      // The model is sent the same tools, in the same order, with and without the list call.
      const [first, second] = harness.mock.json();
      assertEquals(second?.["tools"], first?.["tools"]);
    });
  },
);

Deno.test(
  "an unknown_tool result drops the cached list, so the next turn reads it again",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "u1", name: "search_foods", input: { query: "egg" } }]),
          reply("Sorry."),
          reply("Fine."),
          reply("Fine again."),
        ],
        answers: { search_foods: errorResult("search_foods", "unknown_tool") },
      },
      async (harness) => {
        await harness.take("first question");
        await harness.take("second question");
        await harness.take("third question");

        assertEquals(harness.connections[1]?.log, ["listTools", "close"]);
        assertEquals(harness.connections[2]?.log, ["close"]);
      },
    );
  },
);

Deno.test(
  "listTools runs once per turn before any callTool, and connectToolServer gets the turn's options",
  async () => {
    const hasActionCalls: string[] = [];
    await withHarness(
      {
        wrapTurns: (turns) => ({
          ...turns,
          turnHasAction: (turnId) => {
            hasActionCalls.push(turnId);
            return Promise.resolve(true);
          },
        }),
        responses: [
          callTools([
            { id: "s1", name: "search_foods", input: { query: "egg" } },
            { id: "s2", name: "search_foods", input: { query: "toast" } },
          ]),
          callTools([{ id: "s3", name: "search_foods", input: { query: "jam" } }]),
          reply("Done."),
        ],
      },
      async (harness) => {
        const result = await harness.take("find an egg", { localTime: "13:00" });

        assertEquals(harness.connections[0]?.log, [
          "listTools",
          "callTool:search_foods",
          "callTool:search_foods",
          "callTool:search_foods",
          "close",
        ]);
        const [options] = harness.connectOptions;
        assertEquals(options?.requestTimeoutMilliseconds, MCP_REQUEST_TIMEOUT_MILLISECONDS);
        assert((options?.requestTimeoutMilliseconds ?? Infinity) <= 20_000);
        assertEquals(options?.accessToken, jwt);
        assertEquals(options?.turnId, result.turnId);
        assertEquals(options?.localDate, "2026-11-03");
        assertEquals(options?.localTime, "13:00");
        assertEquals(options?.functionsBaseUrl, "http://127.0.0.1:54321");
        // It reaches the store's own read, with the turn's id.
        assertEquals(await options?.turnHasAction(result.turnId), true);
        assertEquals(hasActionCalls, [result.turnId]);
        assert(options?.allowedTools.includes("search_foods"));
        assertEquals(options?.allowedTools.includes("import_recipe_from_url"), false);
      },
    );
  },
);

const forbiddenKeys = [
  "mcp_servers",
  "mcp_toolset",
  "betas",
  "temperature",
  "top_p",
  "top_k",
  "budget_tokens",
  "fallbacks",
];

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }
  return isRecord(value)
    ? Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)])
    : [];
}

const withoutCacheControl = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (key, child) => (key === "cache_control" ? undefined : child)));

Deno.test(
  "request bodies carry no connector, beta or sampling key, no personal value, and the same tools and a stable prefix on every turn",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "s1", name: "search_foods", input: { query: "egg" } }]),
          reply("Found eggs."),
          reply("Recipe noted."),
          reply("You ate eggs."),
          reply("Logged."),
        ],
      },
      async (harness) => {
        await harness.take("Log 2 large eggs (100 g)");
        await harness.take("Add this https://example.com/pasta/recipe");
        await harness.take("What did I eat yesterday?");
        await harness.take("Log 2 more eggs");

        const bodies = harness.mock.json();
        assertEquals(bodies.length, 5);
        for (const [index, text] of harness.mock.bodies.entries()) {
          const keys = keysOf(bodies[index]);
          for (const key of forbiddenKeys) {
            assertEquals(keys.includes(key), false, `${key} in request ${index}`);
          }
          assertEquals(text.includes("mcp-client-2025-11-20"), false);
          for (const personal of [
            userId,
            userEmail,
            "female",
            "1990-04-12",
            "173.4",
            "birth_date",
            "height_cm",
          ]) {
            assertEquals(text.includes(personal), false, `${personal} in request ${index}`);
          }
          assertEquals(bodies[index]?.["model"], MODEL);
          assertEquals(bodies[index]?.["tool_choice"], { type: "auto" });
        }
        // The tools array is byte for byte the same on a general, a recipe-import and a read turn.
        const toolBytes = bodies.map((body) => JSON.stringify(body["tools"]));
        assertEquals(new Set(toolBytes).size, 1);
        // The system prompt too.
        assertEquals(new Set(bodies.map((body) => JSON.stringify(body["system"]))).size, 1);
        // Each strict flag is the listed flag: log_entry opted out, the others did not.
        const strictOf = Object.fromEntries(
          (Array.isArray(bodies[0]?.["tools"]) ? bodies[0]["tools"].filter(isRecord) : []).map(
            (tool) => [tool["name"], tool["strict"]],
          ),
        );
        assertEquals(strictOf["log_entry"], undefined);
        assertEquals(strictOf["search_foods"], true);
        // Turn 2's request starts with turn 1's last request and its stored reply, as serialised.
        const turnOneLast = Array.isArray(bodies[1]?.["messages"]) ? bodies[1]["messages"] : [];
        const turnTwoFirst = Array.isArray(bodies[2]?.["messages"]) ? bodies[2]["messages"] : [];
        assertEquals(
          JSON.stringify(withoutCacheControl(turnTwoFirst.slice(0, turnOneLast.length))),
          JSON.stringify(withoutCacheControl(turnOneLast)),
        );
        assertEquals(turnTwoFirst.length, turnOneLast.length + 2);
      },
    );
  },
);

type SchemaNode = Record<string, unknown>;

function countStrictParameters(schema: unknown): { optional: number; union: number } {
  const total = { optional: 0, union: 0 };
  if (!isRecord(schema)) {
    return total;
  }
  const properties = isRecord(schema["properties"]) ? schema["properties"] : {};
  const required = Array.isArray(schema["required"]) ? schema["required"] : [];
  for (const [name, property] of Object.entries(properties)) {
    total.optional += required.includes(name) ? 0 : 1;
    total.union +=
      isRecord(property) && (Array.isArray(property["anyOf"]) || Array.isArray(property["type"]))
        ? 1
        : 0;
    const inner = countStrictParameters(
      isRecord(property) && Array.isArray(property["anyOf"])
        ? property["anyOf"].find((branch: SchemaNode) => branch["type"] !== "null")
        : property,
    );
    total.optional += inner.optional;
    total.union += inner.union;
  }
  const items = countStrictParameters(schema["items"]);
  return { optional: total.optional + items.optional, union: total.union + items.union };
}

Deno.test(
  "the real registry's tools are sent with their strict flags and stay inside the API's caps",
  async () => {
    const tools: ListedTool[] = toolRegistry.list.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: { ...toJsonSchema(tool), type: "object" },
      readOnlyHint: tool.annotations.readOnlyHint,
      strict: tool.strict !== false,
    }));
    await withHarness({ tools, responses: [reply("Hi.")] }, async (harness) => {
      await harness.take("Hello");

      const sent = harness.mock.json()[0]?.["tools"];
      const sentTools = Array.isArray(sent) ? sent.filter(isRecord) : [];
      assertEquals(
        sentTools.map((tool) => [tool["name"], tool["strict"] === true]),
        tools.map((tool) => [tool.name, tool.strict]),
      );
      const strictTools = sentTools.filter((tool) => tool["strict"] === true);
      const counts = strictTools.map((tool) => countStrictParameters(tool["input_schema"]));
      assert(strictTools.length <= 20);
      assert(counts.reduce((sum, count) => sum + count.optional, 0) <= 24);
      assert(counts.reduce((sum, count) => sum + count.union, 0) <= 16);
    });
  },
);

Deno.test(
  "import_recipe_from_url is preceded by a reading_recipe status with the host of the URL",
  async () => {
    let harness: Harness | undefined;
    const writtenBeforeTheCall: string[] = [];
    await withHarness(
      {
        responses: [
          callTools([
            {
              id: "i1",
              name: "import_recipe_from_url",
              input: { url: "https://www.example.com/pasta/recipe" },
            },
          ]),
          reply("Imported."),
        ],
        answers: {
          import_recipe_from_url: async () => {
            // The reader of the stream runs a tick behind the writer.
            await new Promise((resolve) => setTimeout(resolve, 5));
            writtenBeforeTheCall.push(harness?.written.join("") ?? "");
            return okResult({ name: "import_recipe_from_url" });
          },
        },
      },
      async (created) => {
        harness = created;
        const result = await created.take("Add https://www.example.com/pasta/recipe");

        assertEquals(eventsOfType(result.events, "status"), [
          { type: "status", code: "reading_recipe", host: "www.example.com" },
        ]);
        assertStringIncludes(writtenBeforeTheCall[0] ?? "", '"code":"reading_recipe"');
      },
    );
  },
);

// ---- Configuration, logs ----

Deno.test(
  "a missing ANTHROPIC_API_KEY ends the turn failed with a report, and connects to nothing",
  async () => {
    await withHarness({ apiKey: null, responses: [] }, async (harness) => {
      const result = await harness.take("hi");

      assertEquals(typesOf(result.events), ["turn", "notice", "done"]);
      assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
      assertEquals(turnStatuses(harness), ["failed"]);
      assertEquals(harness.reports.length, 1);
      assertEquals(harness.connections.length, 0);
      assertEquals(harness.mock.bodies.length, 0);
    });
  },
);

Deno.test(
  "createModelClient builds the client per call from the key and the base URL, with the fitted timeout",
  () => {
    const environment: Record<string, string> = {};
    assertEquals(
      createModelClient((name) => environment[name]),
      null,
    );
    environment["ANTHROPIC_API_KEY"] = "  ";
    assertEquals(
      createModelClient((name) => environment[name]),
      null,
    );
    environment["ANTHROPIC_API_KEY"] = "sk-test";
    environment["ANTHROPIC_BASE_URL"] = "http://127.0.0.1:9999";

    const client = createModelClient((name) => environment[name]);

    assertEquals(client?.baseURL, "http://127.0.0.1:9999");
    assertEquals(client?.timeout, MODEL_REQUEST_TIMEOUT_MILLISECONDS);
    // The SDK logs the raw data of a stream event it cannot parse, which would be message content.
    assertEquals(client?.logLevel, "off");
    // Two attempts of the timeout fit inside the shortest wall-clock limit of an Edge Function (150 s).
    assert((client?.maxRetries ?? 0) + 1 <= 2);
    assert(MODEL_REQUEST_TIMEOUT_MILLISECONDS * ((client?.maxRetries ?? 0) + 1) < 150_000);
  },
);

Deno.test(
  "no log line holds message text, a tool argument or a result, and each turn logs one summary line",
  async () => {
    const spy = spyOnConsole();
    try {
      await withHarness(
        {
          responses: [
            callTools(
              [{ id: "l1", name: "log_entry", input: { food_id: "eggs-100g" } }],
              "2 large eggs (100 g)",
            ),
            reply("Logged 2 large eggs (100 g)."),
          ],
          answers: { log_entry: loggedCall(actionA, "2 large eggs (100 g)", 143) },
        },
        async (harness) => {
          await harness.take("2 large eggs (100 g)");
        },
      );
    } finally {
      spy.restore();
    }

    for (const line of spy.lines) {
      assertEquals(line.includes("eggs"), false, line);
      assertEquals(line.includes("143"), false, line);
    }
    const summaries = spy.lines.filter((line) => line.startsWith("assistant turn "));
    assertEquals(summaries.length, 1);
    assertStringIncludes(summaries[0] ?? "", `user=${userId}`);
    assertStringIncludes(summaries[0] ?? "", "modelCalls=2");
    assertStringIncludes(summaries[0] ?? "", "toolCalls=1");
    assertStringIncludes(summaries[0] ?? "", "ending=complete");
    assert(/\d+ms$/.test(summaries[0] ?? ""));
  },
);

// ---- Turns that fail early, and the tool_result-first rule ----

Deno.test(
  "a turn that fails before its message is rewritten does not break the conversation for the next turn",
  async () => {
    let timeZoneReads = 0;
    await withHarness(
      {
        wrapTurns: (turns) => ({
          ...turns,
          readTimeZone: (userId) => {
            timeZoneReads += 1;
            return timeZoneReads === 2
              ? Promise.reject(new Error("the time zone could not be read"))
              : turns.readTimeZone(userId);
          },
        }),
        responses: [
          callTools([
            {
              id: "a1",
              name: "ask_user",
              input: { question: "How much rice?", quick_replies: ["150 g"] },
            },
          ]),
          reply("Logged."),
        ],
      },
      async (harness) => {
        await harness.take("log rice");
        const failed = await harness.take("hello?");
        await harness.take("150 g");

        assertEquals(failed.events.at(-1), { type: "done", outcome: "failed" });
        assertEquals(harness.mock.bodies.length, 2);
        const messages = harness.mock.json()[1]?.["messages"];
        const sent = Array.isArray(messages) ? messages.filter(isRecord) : [];
        assertEquals(
          sent.map((message) => message["role"]),
          ["user", "assistant", "user"],
        );
        const [first] = blocksOf(sent.at(-1)?.["content"]);
        assertEquals(first?.["type"], "tool_result");
        assertEquals(first?.["tool_use_id"], "a1");
        assertEquals(turnStatuses(harness), ["clarify", "failed", "complete"]);
      },
    );
  },
);

// ---- Retrying an unparseable tool input ----

Deno.test(
  "a tool input the SDK cannot parse is not re-issued once text of that call has been shown",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "s1", name: "search_foods", rawJson: '{"query" "egg"}' }], "Looking"),
          reply("Found it."),
        ],
      },
      async (harness) => {
        const result = await harness.take("find an egg");

        assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(textOf(result.events), "Looking");
        assertEquals(turnStatuses(harness), ["failed"]);
      },
    );
  },
);

Deno.test("an SDK error that is not a JSON parse error is not re-issued", async () => {
  await withHarness(
    {
      responses: [
        { blocks: [{ type: "text", text: "Hel" }], stopReason: "end_turn", endWithoutStop: true },
        reply("Hello."),
      ],
    },
    async (harness) => {
      const result = await harness.take("hi");

      assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
      assertEquals(harness.mock.bodies.length, 1);
    },
  );
  await withHarness(
    {
      responses: [{ blocks: [], stopReason: "end_turn", endWithoutStop: true }, reply("Hello.")],
    },
    async (harness) => {
      const result = await harness.take("hi");

      assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
      assertEquals(harness.mock.bodies.length, 1);
    },
  );
});

// ---- Usage, structured outcomes ----

Deno.test(
  "a usage insert that fails on a good response is reported and the turn goes on",
  async () => {
    await withHarness({ failUsage: true, responses: [reply("Hello there")] }, async (harness) => {
      const result = await harness.take("hi");

      assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
      assertEquals(rowsOfRole(harness, "assistant").length, 1);
      assertEquals(turnStatuses(harness), ["complete"]);
      assertEquals(harness.reports.length, 1);
    });
  },
);

Deno.test(
  "a structured outcome the loop cannot read is reported, and a null one is not",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "g1", name: "get_day", input: { local_date: "2026-11-03" } }]),
          reply("Done."),
        ],
        answers: { get_day: okResult({ structured: "not an object" }) },
      },
      async (harness) => {
        const result = await harness.take("What did I eat today?");

        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        assertEquals(harness.reports.length, 1);
      },
    );
    await withHarness(
      {
        responses: [
          callTools([{ id: "g1", name: "get_day", input: { local_date: "2026-11-03" } }]),
          reply("Done."),
        ],
        answers: { get_day: okResult({ structured: null }) },
      },
      async (harness) => {
        await harness.take("What did I eat today?");

        assertEquals(harness.reports, []);
      },
    );
  },
);

// ---- The answer meta only goes with a complete answer ----

Deno.test(
  "no answer meta is sent when the turn ends in a clarify, a confirm, a failure or a stop",
  async () => {
    const read = callTools([{ id: "g1", name: "get_day", input: { local_date: "2026-11-02" } }]);
    const cited = okResult({
      structured: {
        citation: "Based on 3 entries, 2 Nov",
        estimate: "Trend weight is an estimate",
      },
    });
    const endings: [string, HarnessOptions][] = [
      [
        "clarify",
        {
          responses: [
            read,
            callTools([
              { id: "a1", name: "ask_user", input: { question: "Which?", quick_replies: [] } },
            ]),
          ],
          answers: { get_day: cited },
        },
      ],
      [
        "confirm",
        {
          responses: [
            read,
            callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }], "Delete?"),
          ],
          answers: {
            get_day: cited,
            delete_entry: confirmationResult("delete_entry", confirmationId),
          },
        },
      ],
      [
        "failed",
        {
          responses: [read, { blocks: [], stopReason: "end_turn", httpStatus: 400 }],
          answers: { get_day: cited },
        },
      ],
    ];
    for (const [name, options] of endings) {
      await withHarness(options, async (harness) => {
        const result = await harness.take("How did I do on Monday and what should I delete?");

        assertEquals(typesOf(result.events).includes("answer_meta"), false, name);
        assertEquals(typesOf(result.events).includes("done"), true, name);
      });
    }
    let run: ReturnType<Harness["start"]> | undefined;
    await withHarness(
      {
        responses: [read, reply("never asked for")],
        answers: {
          get_day: async () => {
            await run?.cancel();
            return cited;
          },
        },
      },
      async (harness) => {
        run = harness.start("How did I do on Monday?");
        const result = await run.finished;

        assertEquals(turnStatuses(harness), ["stopped"]);
        assertEquals(typesOf(result.events).includes("answer_meta"), false, "stopped");
      },
    );
  },
);
