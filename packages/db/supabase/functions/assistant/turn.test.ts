import { assert, assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";

import { toolRegistry } from "../_shared/assistant/registry.ts";
import { spyOnConsole } from "../_shared/assistant/testing.ts";
import { toJsonSchema } from "../_shared/assistant/tool.ts";
import {
  confirmDeleteButtons,
  confirmTargetsButtons,
  describeAssistantStatus,
  threadFromMessages,
} from "../_shared/core.ts";
import { contextBlock, MODEL } from "./prompt.ts";
import {
  MAX_EXERCISE_MUSCLES_CARDS,
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
import type { AssistantExerciseMuscles, AssistantStreamEvent } from "../_shared/core.ts";
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
// For the tests of other behaviour, so a step on the working line does not have to be spelt out in each.
const withoutStatus = (events: readonly AssistantStreamEvent[]) =>
  events.filter((event) => event.type !== "status");
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
          typesOf(withoutStatus(result.events)).filter((type) => type !== "text"),
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
          typesOf(withoutStatus(result.events)).filter((type) => type !== "text"),
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
  "a note on the confirmation is added after the model's question as its own paragraph, and the stored row holds the same question",
  async () => {
    const note = "Your macros will be adjusted proportionally: protein 118 g.";
    await withHarness(
      {
        responses: [
          callTools(
            [{ id: "u1", name: "update_targets", input: { current_kcal: 2140 } }],
            "  Change your calorie target from 2,140 to 2,000 kcal?  ",
          ),
          reply("must not be asked for"),
        ],
        answers: { update_targets: confirmationResult("update_targets", confirmationId, { note }) },
      },
      async (harness) => {
        const result = await harness.take("set my calories to 2000");

        const question = `Change your calorie target from 2,140 to 2,000 kcal?\n\n${note}`;
        assertEquals(eventsOfType(result.events, "confirm"), [
          {
            type: "confirm",
            confirmationId,
            question,
            ...confirmTargetsButtons(2140),
            tone: "primary",
          },
        ]);
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(toolResultRows(harness)[0]?.display, {
          u1: {
            confirm: {
              confirmationId,
              question,
              ...confirmTargetsButtons(2140),
              tone: "primary",
            },
          },
        });
      },
    );
  },
);

Deno.test("a confirmation with no note leaves the model's question as it is", async () => {
  await withHarness(
    {
      responses: [
        callTools(
          [{ id: "u1", name: "update_targets", input: { current_kcal: 2140 } }],
          "Change your calorie target from 2,140 to 2,000 kcal?",
        ),
      ],
      answers: { update_targets: confirmationResult("update_targets", confirmationId) },
    },
    async (harness) => {
      const result = await harness.take("set my calories to 2000 and protein to 150");

      assertEquals(
        eventsOfType(result.events, "confirm")[0]?.["question"],
        "Change your calorie target from 2,140 to 2,000 kcal?",
      );
    },
  );
});

const deleteQuestion =
  "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and an apple.";
const macrosNote = "Your macros will be adjusted proportionally: protein 118 g.";

Deno.test(
  "a model that wrote no question gets the tool's own words in the confirm event and the stored row, and the turn ends confirm",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }]),
          reply("must not be asked for"),
        ],
        answers: {
          delete_entry: confirmationResult("delete_entry", confirmationId, {
            question: deleteQuestion,
          }),
        },
      },
      async (harness) => {
        const result = await harness.take("delete all of my entries on D in one go");

        const expected = {
          confirmationId,
          question: deleteQuestion,
          ...confirmDeleteButtons(3),
          tone: "danger",
        };
        assertEquals(eventsOfType(result.events, "confirm"), [{ type: "confirm", ...expected }]);
        assertEquals(result.events.at(-1), { type: "done", outcome: "confirm" });
        assertEquals(turnStatuses(harness), ["confirm"]);
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(harness.reports.length, 0);
        assertEquals(toolResultRows(harness)[0]?.display, { d1: { confirm: expected } });
        // The stored thread holds the question once, as the confirm and not as a reply before it.
        const thread = threadFromMessages(result.rows, []);
        assertEquals(
          thread.map((item) => item.kind),
          ["user", "confirm"],
        );
      },
    );
  },
);

Deno.test(
  "a model that wrote no question gets the tool's note after the tool's words, as its own paragraph",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "u1", name: "update_targets", input: { current_kcal: 2140 } }]),
        ],
        answers: {
          update_targets: confirmationResult("update_targets", confirmationId, {
            question: "Change your calorie target from 2,140 to 2,000 kcal?",
            note: macrosNote,
          }),
        },
      },
      async (harness) => {
        const result = await harness.take("set my calories to 2000");

        const question = `Change your calorie target from 2,140 to 2,000 kcal?\n\n${macrosNote}`;
        assertEquals(eventsOfType(result.events, "confirm")[0]?.["question"], question);
        assertEquals(toolResultRows(harness)[0]?.display, {
          u1: {
            confirm: {
              confirmationId,
              question,
              ...confirmTargetsButtons(2140),
              tone: "primary",
            },
          },
        });
        const stored = threadFromMessages(result.rows, []).find((item) => item.kind === "confirm");
        assertEquals(stored?.kind === "confirm" ? stored.question : null, question);
      },
    );
  },
);

Deno.test(
  "a confirmation asked again uses the tool's question and not the model's words, which stay above it",
  async () => {
    await withHarness(
      {
        responses: [
          callTools(
            [{ id: "d1", name: "delete_entry", input: { ids: entryIds } }],
            "Deleting those now.",
          ),
          reply("must not be asked for"),
        ],
        answers: {
          delete_entry: confirmationResult("delete_entry", confirmationId, {
            question: deleteQuestion,
            asksAgain: true,
          }),
        },
      },
      async (harness) => {
        const result = await harness.take("yes please");

        assertEquals(eventsOfType(result.events, "confirm"), [
          {
            type: "confirm",
            confirmationId,
            question: deleteQuestion,
            ...confirmDeleteButtons(3),
            tone: "danger",
          },
        ]);
        // The model's text has already streamed, so it is what the thread shows above the question.
        assertEquals(
          eventsOfType(result.events, "text")
            .map((event) => event["delta"])
            .join(""),
          "Deleting those now.",
        );
        assertEquals(turnStatuses(harness), ["confirm"]);
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(harness.reports.length, 0);
      },
    );
  },
);

Deno.test(
  "a confirmation asked again after a typed yes is drawn once, with the old buttons gone, from the stored thread",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }], deleteQuestion),
          callTools([{ id: "d2", name: "delete_entry", input: { ids: entryIds } }]),
        ],
        answers: {
          delete_entry: confirmationResult("delete_entry", confirmationId, {
            question: deleteQuestion,
          }),
        },
      },
      async (harness) => {
        await harness.take("delete my lunch");
        const again = await harness.take("yes please");

        const thread = threadFromMessages(again.rows, []);
        assertEquals(
          thread.map((item) => item.kind),
          // The first question was the model's reply, which the sheet draws once with the buttons under it.
          // The second turn's model wrote nothing, so the tool's question is the confirm alone.
          ["user", "reply", "confirm", "user", "confirm"],
        );
        const confirms = thread.filter((item) => item.kind === "confirm");
        assertEquals(
          confirms.map((item) => item.answered),
          [true, false],
        );
        assertEquals(
          confirms.map((item) => item.question),
          [deleteQuestion, deleteQuestion],
        );
      },
    );
  },
);

Deno.test("a model that wrote a question keeps its own words, not the tool's", async () => {
  await withHarness(
    {
      responses: [
        callTools(
          [{ id: "d1", name: "delete_entry", input: { ids: entryIds } }],
          "Shall I delete your lunch?",
        ),
      ],
      answers: {
        delete_entry: confirmationResult("delete_entry", confirmationId, {
          question: deleteQuestion,
        }),
      },
    },
    async (harness) => {
      const result = await harness.take("delete my lunch");

      assertEquals(
        eventsOfType(result.events, "confirm")[0]?.["question"],
        "Shall I delete your lunch?",
      );
    },
  );
});

Deno.test(
  "a confirmation with no question from the tool and no text from the model still ends the turn failed",
  async () => {
    await withHarness(
      {
        responses: [callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }])],
        answers: { delete_entry: confirmationResult("delete_entry", confirmationId) },
      },
      async (harness) => {
        const result = await harness.take("delete my lunch");

        assertEquals(typesOf(result.events).includes("confirm"), false);
        assertEquals(result.events.slice(-2), [
          { type: "notice", notice: { code: "turn_failed" } },
          { type: "done", outcome: "failed" },
        ]);
        assertEquals(harness.reports.length, 1);
      },
    );
  },
);

Deno.test(
  "a note with no question text from the model still ends the turn failed, and the note alone is never a question",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "u1", name: "update_targets", input: { current_kcal: 2140 } }], "   "),
        ],
        answers: {
          update_targets: confirmationResult("update_targets", confirmationId, { note: "A line." }),
        },
      },
      async (harness) => {
        const result = await harness.take("set my calories to 2000");

        assertEquals(typesOf(result.events).includes("confirm"), false);
        assertEquals(result.events.slice(-2), [
          { type: "notice", notice: { code: "turn_failed" } },
          { type: "done", outcome: "failed" },
        ]);
        assertEquals(turnStatuses(harness), ["failed"]);
        assertEquals(harness.reports.length, 1);
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

// A turn that ended asking, with the confirmation the `mcp` function would have stored on it.
async function afterAskedDelete(harness: Harness) {
  await harness.take("delete my lunch");
  const [asked] = harness.turnRows();
  if (asked === undefined) {
    throw new Error("expected the asking turn");
  }
  asked["pending_confirmation"] = {
    id: confirmationId,
    tool: "delete_entry",
    input_hash: "a".repeat(64),
    confirm_label: confirmDeleteButtons(3).confirmLabel,
  };
}

const askingThenAnswering = (answer: ScriptedResponse): HarnessOptions => ({
  responses: [
    callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }], deleteQuestion),
    answer,
  ],
  answers: { delete_entry: confirmationResult("delete_entry", confirmationId) },
});

Deno.test(
  "after a confirmation, a message that is not the button's words does not get the tool that was asked about",
  async () => {
    await withHarness(askingThenAnswering(reply("2,140.")), async (harness) => {
      await afterAskedDelete(harness);

      await harness.take("How many calories are left?");

      assertEquals(harness.connectOptions[1]?.allowedTools.includes("delete_entry"), false);
    });
  },
);

Deno.test(
  "after a confirmation, a link in the message does not get the tool that was asked about",
  async () => {
    await withHarness(askingThenAnswering(reply("Imported.")), async (harness) => {
      await afterAskedDelete(harness);

      await harness.take("https://example.com/pasta/recipe");

      assertEquals(harness.connectOptions[1]?.allowedTools.includes("delete_entry"), false);
    });
  },
);

Deno.test(
  "after a confirmation, the button's words get the tool that was asked about, in any case",
  async () => {
    await withHarness(askingThenAnswering(reply("Deleted.")), async (harness) => {
      await afterAskedDelete(harness);

      await harness.take("  delete 3 ENTRIES ");

      assertEquals(harness.connectOptions[1]?.allowedTools.includes("delete_entry"), true);
    });
  },
);

// ---- The confirm button runs the stored call in code (KEY-840) ----

const deleteLabel = confirmDeleteButtons(3).confirmLabel;
const deleteCancelLabel = confirmDeleteButtons(3).cancelLabel;
const deletedAction = "00000000-0000-4000-8000-0000000000a7";

const deletedCall = () =>
  okResult({
    name: "delete_entry",
    structured: { card: cardDraft("Chicken and rice", 612) },
    actionId: deletedAction,
  });

// The turn that asks, with no model response left for anything after it.
const askingOnly = (second: ToolAnswer = deletedCall()): HarnessOptions => ({
  responses: [
    callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }], deleteQuestion),
  ],
  answers: {
    delete_entry: inSequence(confirmationResult("delete_entry", confirmationId), second),
  },
});

const pressedCalls = (harness: Harness) => harness.connections[1]?.calls ?? [];

Deno.test(
  "the button's words make the one stored call with the pending id and no model call, and the card is the answer",
  async () => {
    const spy = spyOnConsole();
    try {
      await withHarness(askingOnly(), async (harness) => {
        await afterAskedDelete(harness);

        const result = await harness.take(deleteLabel);

        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(pressedCalls(harness).length, 1);
        assertEquals(pressedCalls(harness)[0]?.name, "delete_entry");
        assertEquals(pressedCalls(harness)[0]?.input, {
          ids: entryIds,
          confirmation_id: confirmationId,
        });
        assertEquals(typesOf(withoutStatus(result.events)), ["turn", "card", "done"]);
        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        assertEquals(turnStatuses(harness), ["confirm", "complete"]);
        assertEquals(harness.usageRows().length, 1);
        assertEquals(harness.reports.length, 0);
        assertEquals(harness.connections[1]?.closeCount, 1);

        // The stored turn is the person's words, the call as an assistant row and the result with the card.
        const stored = result.rows.filter((row) => row.turnId === result.turnId);
        assertEquals(
          stored.map((row) => row.role),
          ["user", "assistant", "user"],
        );
        const [call] = blocksOf(stored[1]?.content);
        assertEquals(call?.["type"], "tool_use");
        assertEquals(call?.["name"], "delete_entry");
        assertNotEquals(call?.["id"], "d1");
        assertEquals(call?.["input"], { ids: entryIds, confirmation_id: confirmationId });
        const [answer] = blocksOf(stored[2]?.content);
        assertEquals(answer?.["tool_use_id"], call?.["id"]);
        const display = stored[2]?.display;
        assert(isRecord(display) && isRecord(display[String(call?.["id"])]));
        assertEquals(
          eventsOfType(result.events, "card").map((event) => event.card.actionIds),
          [[deletedAction]],
        );
      });
    } finally {
      spy.restore();
    }

    const summaries = spy.lines.filter((line) => line.startsWith("assistant turn "));
    assertStringIncludes(summaries.at(-1) ?? "", "modelCalls=0 toolCalls=1 ending=complete");
    for (const line of spy.lines) {
      const content = withoutIdsAndDurations(line);
      assertEquals(content.includes("Delete 3"), false, line);
      assertEquals(content.includes("612"), false, line);
    }
  },
);

Deno.test("any case and spaces around the button's words behave the same", async () => {
  await withHarness(askingOnly(), async (harness) => {
    await afterAskedDelete(harness);

    const result = await harness.take("  delete 3 ENTRIES ");

    assertEquals(harness.mock.bodies.length, 1);
    assertEquals(pressedCalls(harness).length, 1);
    assertEquals(typesOf(withoutStatus(result.events)), ["turn", "card", "done"]);
  });
});

// What a press that wrote nothing is reported as. A result the person can cause (the entry or the recipe is
// already gone, a state already in place, a confirmation already spent, the write limit, a workout in progress) ends with the notice and
// is not reported, so Sentry holds only what is unexpected.
for (const [label, answer, reportCount] of [
  ["a tool_failed error", errorResult("delete_entry", "tool_failed"), 1],
  ["an invalid_input error", errorResult("delete_entry", "invalid_input"), 1],
  ["a confirmation_invalid error", errorResult("delete_entry", "confirmation_invalid"), 0],
  ["a write_limit_reached error", errorResult("delete_entry", "write_limit_reached"), 0],
  ["a workout_in_progress error", errorResult("delete_entry", "workout_in_progress"), 0],
  ["not_found", okResult({ name: "delete_entry", payload: { error: "not_found" } }), 0],
  ["changed false", okResult({ name: "delete_entry", payload: { changed: false } }), 0],
] as const) {
  Deno.test(
    `a tool that answers ${label} ends the press with the failed notice and no card or model call, and ${reportCount === 0 ? "reports nothing" : "reports it"}`,
    async () => {
      await withHarness(askingOnly(answer), async (harness) => {
        await afterAskedDelete(harness);

        const result = await harness.take(deleteLabel);

        assertEquals(typesOf(withoutStatus(result.events)), ["turn", "notice", "done"]);
        assertEquals(result.events.slice(-2), [
          { type: "notice", notice: { code: "turn_failed" } },
          { type: "done", outcome: "failed" },
        ]);
        assertEquals(turnStatuses(harness), ["confirm", "failed"]);
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(pressedCalls(harness).length, 1);
        assertEquals(harness.reports.length, reportCount);
        assertEquals(
          harness.reports.every(
            ({ code, caught }) =>
              code === "internal_error" && !String(caught).includes(entryIds[0] ?? ""),
          ),
          true,
        );
      });
    },
  );
}

for (const [label, answer] of [
  ["no card at all", okResult({ name: "delete_entry", actionId: deletedAction })],
  [
    "a card the app cannot draw",
    okResult({
      name: "delete_entry",
      structured: { card: { kind: "not_a_card" } },
      actionId: deletedAction,
    }),
  ],
] as const) {
  Deno.test(
    `a press whose write landed with ${label} ends complete with no notice, because nothing is untrue`,
    async () => {
      const spy = spyOnConsole();
      try {
        await withHarness(askingOnly(answer), async (harness) => {
          await afterAskedDelete(harness);

          const result = await harness.take(deleteLabel);

          assertEquals(typesOf(withoutStatus(result.events)), ["turn", "done"]);
          assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
          assertEquals(turnStatuses(harness), ["confirm", "complete"]);
          assertEquals(harness.mock.bodies.length, 1);
          assertEquals(harness.reports.length > 0, true);
        });
      } finally {
        spy.restore();
      }

      const summaries = spy.lines.filter((line) => line.startsWith("assistant turn "));
      assertStringIncludes(
        summaries.at(-1) ?? "",
        "modelCalls=0 toolCalls=1 ending=confirm_written_no_card",
      );
    },
  );
}

Deno.test("a press that ends failed logs confirm_nothing_written", async () => {
  const spy = spyOnConsole();
  try {
    await withHarness(askingOnly(errorResult("delete_entry", "tool_failed")), async (harness) => {
      await afterAskedDelete(harness);
      await harness.take(deleteLabel);
    });
  } finally {
    spy.restore();
  }

  const summaries = spy.lines.filter((line) => line.startsWith("assistant turn "));
  assertStringIncludes(
    summaries.at(-1) ?? "",
    "modelCalls=0 toolCalls=1 ending=confirm_nothing_written",
  );
});

Deno.test(
  "a tool that asks again on the press sends the confirm event with the tool's question and ends confirm",
  async () => {
    const asksAgain = confirmationResult("delete_entry", "00000000-0000-4000-8000-0000000000c8", {
      question: deleteQuestion,
      asksAgain: true,
    });
    await withHarness(askingOnly(asksAgain), async (harness) => {
      await afterAskedDelete(harness);

      const result = await harness.take(deleteLabel);

      assertEquals(typesOf(withoutStatus(result.events)), ["turn", "confirm", "done"]);
      assertEquals(eventsOfType(result.events, "confirm")[0]?.question, deleteQuestion);
      assertEquals(result.events.at(-1), { type: "done", outcome: "confirm" });
      assertEquals(turnStatuses(harness), ["confirm", "confirm"]);
      assertEquals(harness.mock.bodies.length, 1);
    });
  },
);

Deno.test(
  "a press whose stored call cannot be found makes no call and fails honestly",
  async () => {
    await withHarness(askingOnly(), async (harness) => {
      await afterAskedDelete(harness);
      const [asked] = harness.turnRows();
      asked?.["pending_confirmation"] &&
        Object.assign(asked["pending_confirmation"], { id: "other" });

      const result = await harness.take(deleteLabel);

      assertEquals(typesOf(result.events), ["turn", "notice", "done"]);
      assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
      assertEquals(turnStatuses(harness), ["confirm", "failed"]);
      assertEquals(pressedCalls(harness), []);
      assertEquals(harness.mock.bodies.length, 1);
      assertEquals(harness.reports.length, 1);
    });
  },
);

Deno.test("a press logs confirm_input_missing when the stored call cannot be found", async () => {
  const spy = spyOnConsole();
  try {
    await withHarness(askingOnly(), async (harness) => {
      await afterAskedDelete(harness);
      const [asked] = harness.turnRows();
      asked?.["pending_confirmation"] &&
        Object.assign(asked["pending_confirmation"], { id: "other" });
      await harness.take(deleteLabel);
    });
  } finally {
    spy.restore();
  }

  const summaries = spy.lines.filter((line) => line.startsWith("assistant turn "));
  assertStringIncludes(
    summaries.at(-1) ?? "",
    "modelCalls=0 toolCalls=0 ending=confirm_input_missing",
  );
});

Deno.test(
  "the cancel button and typed yes-words stay model turns, and the loop makes no call",
  async () => {
    for (const words of [deleteCancelLabel, "yes please"]) {
      await withHarness(askingThenAnswering(reply("Nothing was deleted.")), async (harness) => {
        await afterAskedDelete(harness);

        const result = await harness.take(words);

        assertEquals(harness.mock.bodies.length, 2);
        assertEquals(pressedCalls(harness), []);
        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
      });
    }
  },
);

Deno.test(
  "the button's words after a turn that did not end confirm stay a model turn",
  async () => {
    await withHarness(askingThenAnswering(reply("Which entries?")), async (harness) => {
      await afterAskedDelete(harness);
      const [asked] = harness.turnRows();
      if (asked === undefined) {
        throw new Error("expected the asking turn");
      }
      asked["status"] = "complete";

      await harness.take(deleteLabel);

      assertEquals(harness.mock.bodies.length, 2);
      assertEquals(pressedCalls(harness), []);
    });
  },
);

Deno.test(
  "after a confirmed press, the next request has the call and its result in order and no open tool use",
  async () => {
    await withHarness(
      {
        ...askingOnly(),
        responses: [
          callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }], deleteQuestion),
          reply("You have no entries left."),
        ],
      },
      async (harness) => {
        await afterAskedDelete(harness);
        await harness.take(deleteLabel);

        await harness.take("What did I log today?");

        const messages = messagesOf(harness.mock.json()[1]);
        assertEquals(
          messages.map((message) => message["role"]),
          ["user", "assistant", "user", "assistant", "user"],
        );
        const callIds = messages.flatMap((message) =>
          blocksOf(message["content"]).flatMap((block) =>
            block["type"] === "tool_use" ? [String(block["id"])] : [],
          ),
        );
        assertEquals(callIds.length, 2);
        assertEquals(new Set(callIds).size, 2);
        // Each call is answered by the first block of the user message right after it.
        for (const [index, message] of messages.entries()) {
          if (message["role"] !== "assistant") {
            continue;
          }
          const answered = blocksOf(messages[index + 1]?.["content"]).flatMap((block) =>
            block["type"] === "tool_result" ? [String(block["tool_use_id"])] : [],
          );
          const called = blocksOf(message["content"]).flatMap((block) =>
            block["type"] === "tool_use" ? [String(block["id"])] : [],
          );
          assertEquals(answered, called);
        }
        const [pressedCall] = blocksOf(messages[3]?.["content"]);
        assertEquals(pressedCall?.["name"], "delete_entry");
        assertEquals(pressedCall?.["input"], { ids: entryIds, confirmation_id: confirmationId });
        // The new message joins behind the press's result, in one user message, and is last.
        const last = blocksOf(messages[4]?.["content"]);
        assertEquals(last[0]?.["type"], "tool_result");
        assertEquals(last.at(-1)?.["text"], "What did I log today?");
      },
    );
  },
);

Deno.test(
  "a press whose call throws ends failed, and the next turn answers the open call",
  async () => {
    await withHarness(
      {
        ...askingOnly(failingCall()),
        responses: [
          callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }], deleteQuestion),
          reply("Let me check."),
        ],
      },
      async (harness) => {
        await afterAskedDelete(harness);

        const pressed = await harness.take(deleteLabel);
        await harness.take("What did I log today?");

        assertEquals(pressed.events.at(-1), { type: "done", outcome: "failed" });
        assertEquals(pressedCalls(harness).length, 1);
        const messages = messagesOf(harness.mock.json()[1]);
        const last = blocksOf(messages.at(-1)?.["content"]);
        assertEquals(last[0]?.["type"], "tool_result");
        assertEquals(last[0]?.["is_error"], true);
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

// ---- The turn's deadline and the model stream's idle watchdog ----

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

// A stall is found in 400 ms. The deadline is far off, so only the watchdog can fire.
const quickIdleLimits = { deadlineMilliseconds: 60_000, streamIdleMilliseconds: 400 };
// The deadline is short. The watchdog is far off, so only the deadline can fire.
const quickDeadline = (deadlineMilliseconds: number) => ({
  deadlineMilliseconds,
  streamIdleMilliseconds: 60_000,
});

// Deno's test sanitiser does not flag a timer left running, so the limit timers are watched here. They
// are the ones set with these two delays, and each must be cleared or must have fired by the end.
const LONG_DEADLINE_MILLISECONDS = 61_111;
const LONG_IDLE_MILLISECONDS = 62_222;

function watchLimitTimers() {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const running = new Set<unknown>();
  const replace = (name: "setTimeout" | "clearTimeout", value: unknown) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  replace("setTimeout", (...args: Parameters<typeof setTimeout>) => {
    const id = originalSet(...args);
    if (args[1] === LONG_DEADLINE_MILLISECONDS || args[1] === LONG_IDLE_MILLISECONDS) {
      running.add(id);
    }
    return id;
  });
  replace("clearTimeout", (...args: Parameters<typeof clearTimeout>) => {
    running.delete(args[0]);
    return originalClear(...args);
  });
  return {
    running: () => running.size,
    restore() {
      replace("setTimeout", originalSet);
      replace("clearTimeout", originalClear);
    },
  };
}

const failedNotice: AssistantStreamEvent = { type: "notice", notice: { code: "turn_failed" } };

// The one way every limit ends a turn: the failed notice and one done, the status set once, the client
// closed, and one report that carries no content.
function assertEndedFailed(harness: Harness, events: readonly AssistantStreamEvent[]) {
  assertEquals(events.slice(-2), [failedNotice, { type: "done", outcome: "failed" }]);
  assertEquals(eventsOfType(events, "done").length, 1);
  assertEquals(turnStatuses(harness), ["failed"]);
  assertEquals(harness.connections[0]?.closeCount, 1);
  assertEquals(harness.reports.length, 1);
  assertEquals(harness.reports[0]?.code, "internal_error");
}

const summaryLine = (lines: readonly string[]) =>
  lines.filter((line) => line.startsWith("assistant turn "));

Deno.test(
  "a stream that stalls after its headers ends failed as stream_idle, with one usage row",
  async () => {
    const spy = spyOnConsole();
    try {
      await withHarness(
        {
          limits: quickIdleLimits,
          responses: [{ blocks: [], stopReason: "end_turn", holdAfterHeaders: true }],
        },
        async (harness) => {
          const result = await harness.take("my private breakfast");

          assertEndedFailed(harness, result.events);
          assertEquals(harness.usageRows().length, 1);
          assertEquals(rowsOfRole(harness, "assistant"), []);
          assertEquals(harness.mock.bodies.length, 1);
        },
      );
    } finally {
      spy.restore();
    }
    const [summary] = summaryLine(spy.lines);
    assertStringIncludes(summary ?? "", "ending=stream_idle");
    assertEquals(
      spy.lines.some((line) => line.includes("breakfast")),
      false,
    );
  },
);

Deno.test(
  "a stream that stalls mid-text ends failed as stream_idle and stores the partial text as text blocks only",
  async () => {
    await withHarness(
      {
        limits: quickIdleLimits,
        responses: [
          {
            blocks: [
              { type: "thinking", thinking: "hmm", signature: "sig" },
              { type: "text", text: "Let me think about that for you" },
              { type: "tool_use", id: "s1", name: "search_foods", input: { query: "egg" } },
            ],
            stopReason: "tool_use",
            holdAfterFirstText: true,
          },
        ],
      },
      async (harness) => {
        const result = await harness.take("hello");

        assertEndedFailed(harness, result.events);
        const [assistant] = rowsOfRole(harness, "assistant");
        const blocks = blocksOf(assistant?.content);
        assert(blocks.length > 0);
        assert(
          blocks.every((block) => block["type"] === "text" && String(block["text"]).trim() !== ""),
        );
        assertEquals(harness.usageRows().length, 1);
        assertEquals(harness.connections[0]?.calls, []);
      },
    );
  },
);

Deno.test("a deadline that passes during a model stream ends failed as turn_deadline", async () => {
  const spy = spyOnConsole();
  try {
    await withHarness(
      {
        limits: quickDeadline(500),
        responses: [
          {
            blocks: [{ type: "text", text: "Let me think about that for you" }],
            stopReason: "end_turn",
            holdAfterFirstText: true,
          },
        ],
      },
      async (harness) => {
        const result = await harness.take("hello");

        assertEndedFailed(harness, result.events);
        const [assistant] = rowsOfRole(harness, "assistant");
        assert(blocksOf(assistant?.content).every((block) => block["type"] === "text"));
        assertEquals(harness.usageRows().length, 1);
      },
    );
  } finally {
    spy.restore();
  }
  assertStringIncludes(summaryLine(spy.lines)[0] ?? "", "ending=turn_deadline");
});

Deno.test(
  "a turn that passes its deadline during a tool call starts no model call after it and ends failed",
  async () => {
    const slowRead: ToolAnswer = async () => {
      await sleep(900);
      return okResult({ name: "search_foods" });
    };
    await withHarness(
      {
        limits: quickDeadline(500),
        responses: [
          callTools([{ id: "s1", name: "search_foods", input: { query: "egg" } }]),
          callTools([{ id: "s2", name: "search_foods", input: { query: "toast" } }]),
          reply("never asked for"),
        ],
        answers: { search_foods: slowRead },
      },
      async (harness) => {
        const result = await harness.take("find breakfast");

        assertEndedFailed(harness, result.events);
        assertEquals(harness.mock.bodies.length, 1);
        assertEquals(harness.connections[0]?.calls.length, 1);
        assertEquals(harness.usageRows().length, 1);
        assertEquals(toolResultRows(harness).length, 1);
      },
    );
  },
);

Deno.test(
  "a deadline that passes while the response headers are awaited ends failed as turn_deadline",
  async () => {
    const timers = watchLimitTimers();
    const spy = spyOnConsole();
    try {
      await withHarness(
        {
          limits: { deadlineMilliseconds: 500, streamIdleMilliseconds: LONG_IDLE_MILLISECONDS },
          responses: [{ blocks: [], stopReason: "end_turn", neverAnswer: true }],
        },
        async (harness) => {
          const result = await harness.take("hello");

          assertEndedFailed(harness, result.events);
          assertEquals(harness.usageRows().length, 1);
          assertEquals(harness.mock.bodies.length, 1);
          assertEquals(timers.running(), 0);
        },
      );
    } finally {
      spy.restore();
      timers.restore();
    }
    assertStringIncludes(summaryLine(spy.lines)[0] ?? "", "ending=turn_deadline");
  },
);

Deno.test(
  "a write in flight at the deadline finishes and keeps its result and card, and nothing further runs",
  async () => {
    await withHarness(
      {
        limits: quickDeadline(500),
        responses: [
          callTools([
            { id: "l1", name: "log_entry", input: { food_id: "eggs-100g" } },
            { id: "g1", name: "get_day", input: { local_date: "2026-11-03" } },
          ]),
          reply("never asked for"),
        ],
        answers: {
          log_entry: async () => {
            await sleep(900);
            return loggedCall(actionA, "egg", 143);
          },
        },
      },
      async (harness) => {
        const result = await harness.take("log an egg");

        assertEndedFailed(harness, result.events);
        assertEquals(
          harness.connections[0]?.calls.map((call) => call.name),
          ["log_entry"],
        );
        const [stored] = toolResultRows(harness);
        assertEquals(
          toolResultRows(harness)
            .flatMap((row) => blocksOf(row.content))
            .map((block) => block["tool_use_id"]),
          ["l1"],
        );
        assert(isRecord(stored?.display) && "l1" in stored.display);
        assertEquals(eventsOfType(result.events, "card").length, 1);
        assertEquals(harness.mock.bodies.length, 1);
      },
    );
  },
);

Deno.test(
  "a reader that goes away after the deadline fired still gives stopped and no done",
  async () => {
    let run: ReturnType<Harness["start"]> | undefined;
    await withHarness(
      {
        limits: quickDeadline(500),
        responses: [
          callTools([{ id: "s1", name: "search_foods", input: { query: "egg" } }]),
          reply("never asked for"),
        ],
        answers: {
          search_foods: async () => {
            await sleep(900);
            await run?.cancel();
            return okResult({ name: "search_foods" });
          },
        },
      },
      async (harness) => {
        run = harness.start("find an egg");
        const result = await run.finished;

        assertEquals(typesOf(result.events).includes("done"), false);
        assertEquals(typesOf(result.events).includes("notice"), false);
        assertEquals(turnStatuses(harness), ["stopped"]);
        assertEquals(harness.connections[0]?.closeCount, 1);
        assertEquals(harness.mock.bodies.length, 1);
      },
    );
  },
);

Deno.test("a turn that ends well inside its limits leaves no timer running", async () => {
  const timers = watchLimitTimers();
  try {
    await withHarness(
      {
        limits: {
          deadlineMilliseconds: LONG_DEADLINE_MILLISECONDS,
          streamIdleMilliseconds: LONG_IDLE_MILLISECONDS,
        },
        responses: [reply("Hi")],
      },
      async (harness) => {
        const result = await harness.take("hi");

        assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
        assertEquals(turnStatuses(harness), ["complete"]);
        assertEquals(timers.running(), 0);
      },
    );
  } finally {
    timers.restore();
  }
});

Deno.test("a stream cut by the deadline leaves its idle timer cleared", async () => {
  const timers = watchLimitTimers();
  try {
    await withHarness(
      {
        limits: { deadlineMilliseconds: 500, streamIdleMilliseconds: LONG_IDLE_MILLISECONDS },
        responses: [
          {
            blocks: [{ type: "text", text: "Let me think about that for you" }],
            stopReason: "end_turn",
            holdAfterFirstText: true,
          },
        ],
      },
      async (harness) => {
        await harness.take("hello");

        assertEquals(timers.running(), 0);
      },
    );
  } finally {
    timers.restore();
  }
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

Deno.test("an empty tool list is not cached, so the next turn reads the list again", async () => {
  await withHarness({ tools: [], responses: [reply("One."), reply("Two.")] }, async (harness) => {
    await harness.take("first question");
    await harness.take("second question");

    assertEquals(harness.connections[0]?.log, ["listTools", "close"]);
    assertEquals(harness.connections[1]?.log, ["listTools", "close"]);
    assertEquals(harness.connectOptions[1]?.knownTools, undefined);
  });
});

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
          thinkingStatus,
        ]);
        assertStringIncludes(writtenBeforeTheCall[0] ?? "", '"code":"reading_recipe"');
      },
    );
  },
);

Deno.test(
  "a link typed without its scheme still gets a reading_recipe status with its host",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([
            {
              id: "i1",
              name: "import_recipe_from_url",
              input: { url: "example.com/lemon-traybake", servings: null },
            },
          ]),
          reply("Imported."),
        ],
        answers: {
          import_recipe_from_url: () => okResult({ name: "import_recipe_from_url" }),
        },
      },
      async (created) => {
        const result = await created.take("Add this recipe: example.com/lemon-traybake");

        assertEquals(eventsOfType(result.events, "status"), [
          { type: "status", code: "reading_recipe", host: "example.com" },
          thinkingStatus,
        ]);
      },
    );
  },
);

// ---- The steps of a turn, for the working line (KEY-917) ----

const toolStatus = (tool: string, food: string | null, isConfirmed: boolean) =>
  ({ type: "status", code: "tool", tool, food, isConfirmed }) as const;

const thinkingStatus = { type: "status", code: "thinking" } as const;

// The words of the food a person typed in the tests of what must never be logged or reported.
const foodSentinel = "zanzibar loaf";

Deno.test("a plain answer has no status at all", async () => {
  await withHarness({ responses: [reply("Hello there")] }, async (harness) => {
    const result = await harness.take("Hi");

    assertEquals(
      typesOf(result.events).filter((type) => type !== "text"),
      ["turn", "done"],
    );
    assertEquals(eventsOfType(result.events, "status"), []);
  });
});

Deno.test(
  "a search is announced before its call with the food words, then thinking comes before the words",
  async () => {
    let harness: Harness | undefined;
    const writtenBeforeTheCall: string[] = [];
    await withHarness(
      {
        responses: [
          callTools([{ id: "s1", name: "search_foods", input: { q: "toast" } }]),
          reply("Toast is 80 kcal."),
        ],
        answers: {
          search_foods: async () => {
            // The reader of the stream runs a tick behind the writer.
            await new Promise((resolve) => setTimeout(resolve, 5));
            writtenBeforeTheCall.push(harness?.written.join("") ?? "");
            return okResult({ name: "search_foods" });
          },
        },
      },
      async (created) => {
        harness = created;
        const result = await created.take("how much is toast");

        assertEquals(eventsOfType(result.events, "status"), [
          toolStatus("search_foods", "toast", false),
          thinkingStatus,
        ]);
        assertStringIncludes(writtenBeforeTheCall[0] ?? "", '"code":"tool"');
        assertEquals((writtenBeforeTheCall[0] ?? "").includes('"code":"thinking"'), false);
        assertEquals(
          typesOf(result.events).filter((type) => type !== "text"),
          ["turn", "status", "status", "done"],
        );
        // The second call's words come after the thinking.
        assertEquals(result.events.slice(1, 3), [
          toolStatus("search_foods", "toast", false),
          thinkingStatus,
        ]);
      },
    );
  },
);

Deno.test("get_food is announced with no food words, because its input is only an id", async () => {
  await withHarness(
    {
      responses: [callTools([{ id: "g1", name: "get_food", input: { id: "f1" } }]), reply("Done.")],
      tools: [...fakeTools, listed("get_food", true, { id: { type: "string" } })],
    },
    async (harness) => {
      const result = await harness.take("how much is toast");

      assertEquals(eventsOfType(result.events, "status")[0], toolStatus("get_food", null, false));
    },
  );
});

Deno.test("a search of newlines and 200 characters goes out cleaned and capped", async () => {
  await withHarness(
    {
      responses: [
        callTools([
          {
            id: "s1",
            name: "search_foods",
            input: { q: `toast\r\nwith butter\n${"a".repeat(200)}` },
          },
        ]),
        reply("Found it."),
      ],
    },
    async (harness) => {
      const result = await harness.take("find toast");

      assertEquals(
        eventsOfType(result.events, "status")[0],
        toolStatus("search_foods", `toast with butter ${"a".repeat(42)}`, false),
      );
      assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
    },
  );
});

Deno.test("a search with no usable words goes out with no food", async () => {
  await withHarness(
    {
      responses: [
        callTools([{ id: "s1", name: "search_foods", input: { q: " \n " } }]),
        reply("Found it."),
      ],
    },
    async (harness) => {
      const result = await harness.take("find toast");

      assertEquals(
        eventsOfType(result.events, "status")[0],
        toolStatus("search_foods", null, false),
      );
      assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
    },
  );
});

Deno.test(
  "ask_user, a tool outside the allowlist and an input that is no record send no tool status",
  async () => {
    const cases: [string, ScriptedResponse, string][] = [
      [
        "ask_user",
        callTools([
          { id: "a1", name: "ask_user", input: { question: "How much rice?", quick_replies: [] } },
        ]),
        "log rice",
      ],
      [
        "a tool outside the allowlist",
        callTools([{ id: "d1", name: "delete_entry", input: { ids: entryIds } }]),
        "Add this https://example.com/pasta/recipe please",
      ],
      [
        "an input that is no record",
        callTools([{ id: "s1", name: "search_foods", rawJson: "[1, 2]" }]),
        "find an egg",
      ],
    ];
    for (const [label, response, text] of cases) {
      await withHarness({ responses: [response, reply("Sorry.")] }, async (harness) => {
        const result = await harness.take(text);

        assertEquals(
          eventsOfType(result.events, "status").filter((event) => event.code === "tool"),
          [],
          label,
        );
      });
    }
  },
);

Deno.test(
  "an import keeps its reading_recipe status and sends no tool status for the call",
  async () => {
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
      },
      async (harness) => {
        const result = await harness.take("Add https://www.example.com/pasta/recipe");

        assertEquals(eventsOfType(result.events, "status"), [
          { type: "status", code: "reading_recipe", host: "www.example.com" },
          thinkingStatus,
        ]);
      },
    );
  },
);

Deno.test(
  "an import whose host cannot be read sends no step, so the line stays on thinking",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "i1", name: "import_recipe_from_url", input: { url: "" } }]),
          reply("Sorry."),
        ],
      },
      async (harness) => {
        const result = await harness.take("Add https://www.example.com/pasta/recipe");

        assertEquals(eventsOfType(result.events, "status"), [thinkingStatus]);
      },
    );
  },
);

Deno.test(
  "a model's delete that needs a confirmation sends the tool as not confirmed, then the question, with no thinking after it",
  async () => {
    await withHarness(askingOnly(), async (harness) => {
      const result = await harness.take("delete my lunch");

      assertEquals(
        typesOf(result.events).filter((type) => type !== "text"),
        ["turn", "status", "confirm", "done"],
      );
      assertEquals(eventsOfType(result.events, "status"), [
        toolStatus("delete_entry", null, false),
      ]);
    });
  },
);

Deno.test(
  "the confirm press sends the tool as confirmed before the call, then the card, with no thinking and no model call",
  async () => {
    let harness: Harness | undefined;
    const writtenBeforeThePress: string[] = [];
    await withHarness(
      askingOnly(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        writtenBeforeThePress.push(harness?.written.join("") ?? "");
        return deletedCall();
      }),
      async (created) => {
        harness = created;
        await afterAskedDelete(created);

        const result = await created.take(deleteLabel);

        assertEquals(typesOf(result.events), ["turn", "status", "card", "done"]);
        assertEquals(eventsOfType(result.events, "status"), [
          toolStatus("delete_entry", null, true),
        ]);
        assertStringIncludes(writtenBeforeThePress[0] ?? "", '"isConfirmed":true');
        assertEquals(created.mock.bodies.length, 1);
      },
    );
  },
);

Deno.test("the steps change nothing the model reads and nothing that is stored", async () => {
  await withHarness(
    {
      responses: [
        callTools([{ id: "s1", name: "search_foods", input: { q: foodSentinel } }]),
        reply("Found it."),
      ],
    },
    async (harness) => {
      await harness.take("find some bread");

      for (const body of harness.mock.bodies) {
        assertEquals(body.includes("isConfirmed"), false);
        assertEquals(body.includes('"type":"status"'), false);
        assertEquals(body.includes("Looking up"), false);
      }
      for (const text of [JSON.stringify(harness.rows()), JSON.stringify(harness.turnRows())]) {
        assertEquals(text.includes("isConfirmed"), false);
        assertEquals(text.includes('"code":"tool"'), false);
        assertEquals(text.includes('"code":"thinking"'), false);
      }
    },
  );
});

Deno.test("the food words reach no report and no log line, in a turn that also fails", async () => {
  const spy = spyOnConsole();
  try {
    await withHarness(
      {
        responses: [callTools([{ id: "s1", name: "search_foods", input: { q: foodSentinel } }])],
        answers: { search_foods: failingCall() },
      },
      async (harness) => {
        const result = await harness.take("find some bread");

        assertEquals(eventsOfType(result.events, "status"), [
          toolStatus("search_foods", foodSentinel, false),
        ]);
        assertEquals(result.events.at(-1), { type: "done", outcome: "failed" });
        assertEquals(harness.reports.length, 1);
        for (const { caught } of harness.reports) {
          assertEquals(String(caught).includes(foodSentinel), false);
        }
      },
    );
  } finally {
    spy.restore();
  }

  assertEquals(spy.lines.length > 0, true);
  for (const line of spy.lines) {
    assertEquals(line.includes(foodSentinel), false, line);
  }
});

// A tool added to the registry needs one line in the core table of words, or its step shows "Thinking". This is
// the test that says so. `ask_user` sends a question instead, and a recipe link is `reading_recipe`.
Deno.test("every tool in the registry has words for its step in the core table", () => {
  const withoutRow = toolRegistry.list
    .map((tool) => tool.name)
    .filter((name) => name !== "ask_user" && name !== "import_recipe_from_url")
    .filter(
      (name) =>
        describeAssistantStatus({ code: "tool", tool: name, food: null, isConfirmed: false }) ===
        describeAssistantStatus({ code: "thinking" }),
    );

  assertEquals(
    withoutRow,
    [],
    "A tool has no row in TOOL_WORDS in packages/core/src/copy/assistantNotices.ts: add one line to the table",
  );
});

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

// A log line without the parts that are random or measured: the ids (a UUID can hold any run of digits, such as
// 143), the `user=` and `turn=` values, and the duration. What is left is the words a line could leak.
export function withoutIdsAndDurations(line: string): string {
  return line
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b(user|turn)=\S+/g, "$1=<id>")
    .replace(/\b\d+ms$/, "<duration>");
}

Deno.test(
  "the log check ignores ids and durations that happen to hold the digits it looks for",
  () => {
    const line =
      "assistant turn user=00000000-0000-4000-8000-0000000000a1 turn=18cef451-1432-4a1b-8c3d-0123456789ab modelCalls=2 toolCalls=1 ending=complete 143ms";

    assertEquals(line.includes("143"), true);
    assertEquals(withoutIdsAndDurations(line).includes("143"), false);
    // A leaked result still trips it.
    assertEquals(withoutIdsAndDurations(`${line} calories 143`).includes("143"), true);
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
      const content = withoutIdsAndDurations(line);
      assertEquals(content.includes("eggs"), false, line);
      assertEquals(content.includes("143"), false, line);
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

// ---- Thinking replay (KEY-818) ----

const thinkingReply = (
  signature: string,
  blocks: ScriptedResponse["blocks"],
): ScriptedResponse => ({
  blocks: [{ type: "thinking", thinking: `thought ${signature}`, signature }, ...blocks],
  stopReason: blocks.some((block) => block.type === "tool_use") ? "tool_use" : "end_turn",
});

const messagesOf = (body: Record<string, unknown> | undefined) =>
  Array.isArray(body?.["messages"]) ? body["messages"].filter(isRecord) : [];

const isThinkingBlock = (block: Record<string, unknown>) =>
  block["type"] === "thinking" || block["type"] === "redacted_thinking";

const thinkingBlocksOf = (message: Record<string, unknown>) =>
  blocksOf(message["content"]).filter(isThinkingBlock);

// Three turns, each with thinking. The second one has a tool round, so it makes two model calls.
const threeTurnsOfThinking: ScriptedResponse[] = [
  {
    blocks: [
      { type: "thinking", thinking: "thought one", signature: "sig-turn-1" },
      { type: "redacted_thinking", data: "data-turn-1" },
      { type: "text", text: "Hello." },
    ],
    stopReason: "end_turn",
  },
  thinkingReply("sig-turn-2-call-1", [
    { type: "tool_use", id: "s1", name: "search_foods", input: { query: "egg" } },
  ]),
  thinkingReply("sig-turn-2-call-2", [{ type: "text", text: "Found eggs." }]),
  thinkingReply("sig-turn-3", [{ type: "text", text: "Done." }]),
];

Deno.test("turn 2's request holds no thinking or redacted thinking block from turn 1", async () => {
  await withHarness({ responses: threeTurnsOfThinking }, async (harness) => {
    const turnOne = await harness.take("hi");
    const storedBefore = JSON.stringify(turnOne.rows);
    await harness.take("find an egg");

    const bodies = harness.mock.json();
    // The stored turn 1 holds both kinds, so the request left them out on purpose.
    const turnOneAssistant = rowsOfRole(harness, "assistant")[0];
    assertEquals(
      blocksOf(turnOneAssistant?.content).map((block) => block["type"]),
      ["thinking", "redacted_thinking", "text"],
    );
    const turnTwoFirst = messagesOf(bodies[1]);
    assertEquals(turnTwoFirst.flatMap(thinkingBlocksOf), []);
    // Only the thinking went. The reply is still there.
    assertEquals(
      blocksOf(turnTwoFirst[1]?.["content"]).map((block) => block["text"]),
      ["Hello."],
    );
    // The stored rows are as they were.
    assertEquals(JSON.stringify(harness.rows().slice(0, turnOne.rows.length)), storedBefore);
  });
});

Deno.test(
  "inside one turn's tool loop the earlier responses' thinking goes back unchanged",
  async () => {
    await withHarness({ responses: threeTurnsOfThinking }, async (harness) => {
      await harness.take("hi");
      await harness.take("find an egg");

      const bodies = harness.mock.json();
      const turnTwoSecond = messagesOf(bodies[2]);
      const storedCallOne = rowsOfRole(harness, "assistant")[1];
      // The model's first response of turn 2 is replayed in full, signature and all.
      assertEquals(
        JSON.stringify(turnTwoSecond[3]?.["content"]),
        JSON.stringify(storedCallOne?.content),
      );
      assertEquals(
        thinkingBlocksOf(turnTwoSecond[3] ?? {}).map((block) => block["signature"]),
        ["sig-turn-2-call-1"],
      );
      assertEquals(turnTwoSecond.flatMap(thinkingBlocksOf).length, 1);
    });
  },
);

Deno.test(
  "a change to the system prompt or the tools between turns cannot invalidate a thinking block, because none from before it is sent",
  async () => {
    await withHarness({ responses: threeTurnsOfThinking }, async (harness) => {
      await harness.take("hi");
      await harness.take("find an egg");
      await harness.take("thanks");

      const bodies = harness.mock.json();
      assertEquals(bodies.length, 4);
      // Each turn's first request ends with that turn's user message. Everything in front of it, which
      // is everything a changed system prompt or tool list would have invalidated, holds no thinking.
      for (const first of [0, 1, 3]) {
        const messages = messagesOf(bodies[first]);
        assertEquals(messages.slice(0, -1).flatMap(thinkingBlocksOf), [], `request ${first}`);
        assertEquals(messages.at(-1)?.["role"], "user");
      }
      // And the request that does hold thinking holds only the turn's own, after its user message.
      const secondCall = messagesOf(bodies[2]);
      const ownMessages = secondCall.slice(2);
      assertEquals(secondCall.slice(0, 2).flatMap(thinkingBlocksOf), []);
      assertEquals(ownMessages.flatMap(thinkingBlocksOf).length, 1);
    });
  },
);

Deno.test(
  "roles alternate in every request, with no empty content and no blank block",
  async () => {
    await withHarness({ responses: threeTurnsOfThinking }, async (harness) => {
      await harness.take("hi");
      await harness.take("find an egg");
      await harness.take("thanks");

      for (const [index, body] of harness.mock.json().entries()) {
        const messages = messagesOf(body);
        messages.forEach((message, position) => {
          assertEquals(
            message["role"],
            position % 2 === 0 ? "user" : "assistant",
            `request ${index}`,
          );
          const blocks = blocksOf(message["content"]);
          assertNotEquals(blocks.length, 0, `request ${index}`);
          for (const block of blocks) {
            assertEquals(block["type"] === "text" && String(block["text"]).trim() === "", false);
          }
        });
      }
    });
  },
);

Deno.test(
  "the requests of turns 2 and 3 are byte for byte the same up to the start of turn 2",
  async () => {
    await withHarness({ responses: threeTurnsOfThinking }, async (harness) => {
      await harness.take("hi");
      await harness.take("find an egg");
      await harness.take("thanks");

      const bodies = harness.mock.json();
      const turnTwoFirst = messagesOf(bodies[1]);
      const turnThreeFirst = messagesOf(bodies[3]);
      // Turn 1's two messages, then turn 2's user message, which is where turn 2 starts.
      const startOfTurnTwo = 2;
      const bytesUpTo = (messages: Record<string, unknown>[], end: number) =>
        JSON.stringify(withoutCacheControl(messages.slice(0, end)));
      assertEquals(
        bytesUpTo(turnThreeFirst, startOfTurnTwo + 1),
        bytesUpTo(turnTwoFirst, startOfTurnTwo + 1),
      );
      // The system prompt and the tools are the same too, so the cache reads all of it.
      assertEquals(JSON.stringify(bodies[3]?.["system"]), JSON.stringify(bodies[1]?.["system"]));
      assertEquals(JSON.stringify(bodies[3]?.["tools"]), JSON.stringify(bodies[1]?.["tools"]));
      // Turn 2's own messages are what changes: they lose their thinking once turn 2 is over.
      assertNotEquals(
        bytesUpTo(turnThreeFirst, turnThreeFirst.length),
        bytesUpTo(turnTwoFirst, turnTwoFirst.length),
      );
    });
  },
);

Deno.test("a turn that replays earlier turns logs no message text or thinking", async () => {
  const spy = spyOnConsole();
  try {
    await withHarness({ responses: threeTurnsOfThinking }, async (harness) => {
      await harness.take("my private breakfast");
      await harness.take("find an egg");
    });
    assertEquals(
      spy.lines.some((line) => line.includes("private breakfast") || line.includes("thought")),
      false,
    );
  } finally {
    spy.restore();
  }
});

const turnZero: ScriptedResponse = thinkingReply("sig-turn-0", [{ type: "text", text: "Hello." }]);

const signaturesInRequest = (body: Record<string, unknown> | undefined) =>
  messagesOf(body)
    .flatMap(thinkingBlocksOf)
    .map((block) => block["signature"]);

Deno.test(
  "after a clarify, the next turn replays the question's thinking and no other, and the turn after replays none",
  async () => {
    await withHarness(
      {
        responses: [
          turnZero,
          thinkingReply("sig-question", [
            {
              type: "tool_use",
              id: "a1",
              name: "ask_user",
              input: { question: "How much rice?", quick_replies: ["100 g", "150 g"] },
            },
          ]),
          thinkingReply("sig-answer", [{ type: "text", text: "Logged." }]),
          reply("You are welcome."),
        ],
      },
      async (harness) => {
        await harness.take("hi");
        await harness.take("log rice");
        await harness.take("150 g");
        await harness.take("thanks");

        const bodies = harness.mock.json();
        assertEquals(signaturesInRequest(bodies[2]), ["sig-question"]);
        const question = rowsOfRole(harness, "assistant")[1];
        assertEquals(
          JSON.stringify(messagesOf(bodies[2])[3]?.["content"]),
          JSON.stringify(question?.content),
        );
        assertEquals(signaturesInRequest(bodies[3]), []);
      },
    );
  },
);

Deno.test(
  "after a confirm, the next turn replays the confirm's thinking and no other",
  async () => {
    await withHarness(
      {
        responses: [
          turnZero,
          thinkingReply("sig-confirm", [
            { type: "tool_use", id: "d1", name: "delete_entry", input: { ids: entryIds } },
          ]),
          reply("Deleted."),
          reply("You are welcome."),
        ],
        answers: { delete_entry: confirmationResult("delete_entry", confirmationId) },
      },
      async (harness) => {
        await harness.take("hi");
        await harness.take("delete my lunch");
        await harness.take("yes");
        await harness.take("thanks");

        const bodies = harness.mock.json();
        assertEquals(signaturesInRequest(bodies[2]), ["sig-confirm"]);
        assertEquals(signaturesInRequest(bodies[3]), []);
      },
    );
  },
);

// ---- The previous value an Undo needs, kept beside the card and away from the model (KEY-900) ----

// Words no card, log line or request has any reason to hold, so finding one anywhere is a leak.
const previousValue = {
  routineName: "Sentinel routine 4471",
  deletedAt: "2026-11-03T08:10:00.123456+00:00",
};
const undoOutcome = { previous: previousValue, fingerprint: "fingerprint-8832" };
const sentinels = ["Sentinel routine 4471", "08:10:00.123456", "fingerprint-8832"];

const writeWithUndo = (action: string, undo: unknown = undoOutcome) =>
  okResult({
    name: "log_entry",
    structured: { card: cardDraft("egg", 143), undo },
    actionId: action,
  });

const holdsNoSentinel = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const sentinel of sentinels) {
    assertEquals(text.includes(sentinel), false, sentinel);
  }
};

Deno.test(
  "a streamed write's undo is stored in the display beside its card, with the action id",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "t1", name: "log_entry", input: { food_id: "f1" } }]),
          reply("Done."),
        ],
        answers: { log_entry: writeWithUndo(actionA) },
      },
      async (harness) => {
        await harness.take("log an egg");

        const [toolRow] = toolResultRows(harness);
        assertEquals(toolRow?.display, {
          t1: {
            card: { actionIds: [actionA], ...cardDraft("egg", 143) },
            undo: { actionId: actionA, ...undoOutcome },
          },
        });
      },
    );
  },
);

Deno.test(
  "a confirm press stores the undo of its write in the display, in the same row as the card",
  async () => {
    await withHarness(askingOnly(writeWithUndo(deletedAction)), async (harness) => {
      await afterAskedDelete(harness);

      const result = await harness.take(deleteLabel);

      const stored = result.rows.filter((row) => row.turnId === result.turnId);
      const [call] = blocksOf(stored[1]?.content);
      assertEquals(stored[2]?.display, {
        [String(call?.["id"])]: {
          card: { actionIds: [deletedAction], ...cardDraft("egg", 143) },
          undo: { actionId: deletedAction, ...undoOutcome },
        },
      });
    });
  },
);

Deno.test("an undo the tool gave for a write that landed nothing is not stored", async () => {
  await withHarness(
    {
      responses: [
        callTools([{ id: "t1", name: "log_entry", input: { food_id: "f1" } }]),
        reply("Nothing changed."),
      ],
      answers: {
        log_entry: okResult({ name: "log_entry", structured: { undo: undoOutcome } }),
      },
    },
    async (harness) => {
      await harness.take("log an egg");

      assertEquals(toolResultRows(harness)[0]?.display, null);
    },
  );
});

Deno.test(
  "an undo that cannot be read is dropped and reported without its words, and the card is kept",
  async () => {
    await withHarness(
      {
        responses: [
          callTools([{ id: "t1", name: "log_entry", input: { food_id: "f1" } }]),
          reply("Done."),
        ],
        answers: {
          log_entry: writeWithUndo(actionA, { previous: previousValue, fingerprint: undefined }),
        },
      },
      async (harness) => {
        const result = await harness.take("log an egg");

        assertEquals(toolResultRows(harness)[0]?.display, {
          t1: { card: { actionIds: [actionA], ...cardDraft("egg", 143) } },
        });
        assertEquals(eventsOfType(result.events, "card").length, 1);
        assertEquals(harness.reports.length, 1);
        assertEquals(harness.reports[0]?.code, "internal_error");
        assertEquals(
          harness.reports[0]?.caught instanceof Error && harness.reports[0].caught.message,
          "an undo cannot be stored",
        );
      },
    );
  },
);

Deno.test(
  "no event, request, log line or report holds the undo, on a streamed write and on a press",
  async () => {
    const spy = spyOnConsole();
    try {
      await withHarness(
        {
          responses: [
            callTools([{ id: "t1", name: "log_entry", input: { food_id: "f1" } }]),
            reply("Done."),
            callTools(
              [{ id: "d1", name: "delete_entry", input: { ids: entryIds } }],
              deleteQuestion,
            ),
            reply("You are welcome."),
          ],
          answers: {
            log_entry: writeWithUndo(actionA),
            delete_entry: inSequence(
              confirmationResult("delete_entry", confirmationId),
              writeWithUndo(deletedAction),
            ),
          },
        },
        async (harness) => {
          const streamed = await harness.take("log an egg");
          await harness.take("delete my lunch");
          const [, asked] = harness.turnRows();
          if (asked === undefined) {
            throw new Error("expected the asking turn");
          }
          asked["pending_confirmation"] = {
            id: confirmationId,
            tool: "delete_entry",
            input_hash: "a".repeat(64),
            confirm_label: deleteLabel,
          };
          const pressed = await harness.take(deleteLabel);
          await harness.take("thanks");

          // The value is stored, and nothing the app or the model was sent holds it.
          assertEquals(
            JSON.stringify(harness.rows().map((row) => row.display)).includes(sentinels[0] ?? ""),
            true,
          );
          holdsNoSentinel(streamed.events);
          holdsNoSentinel(pressed.events);
          holdsNoSentinel(harness.written.join(""));
          holdsNoSentinel(harness.mock.bodies.join(""));
          holdsNoSentinel(harness.reports.map((report) => String(report.caught)));
        },
      );
    } finally {
      spy.restore();
    }

    holdsNoSentinel(spy.lines.join("\n"));
  },
);

// ---- The muscles of an exercise (KEY-924) ----

const showMusclesTools = [
  ...fakeTools,
  listed("show_exercise_muscles", true, { exercise_id: { type: "string" } }, false),
];

const romanianDeadlift: AssistantExerciseMuscles = {
  exerciseName: "Romanian Deadlift",
  muscles: [
    { muscle_id: "hamstrings", role: "primary" },
    { muscle_id: "glute_max", role: "secondary" },
  ],
};

const legCurl: AssistantExerciseMuscles = {
  exerciseName: "Seated Leg Curl",
  muscles: [{ muscle_id: "hamstrings", role: "primary" }],
};

const showMuscles = (id: string) => ({
  id,
  name: "show_exercise_muscles",
  input: { exercise_id: `exercise-${id}` },
});

const musclesOf = (exercise: AssistantExerciseMuscles) =>
  okResult({
    name: "show_exercise_muscles",
    payload: { exercise: exercise.exerciseName },
    structured: { exerciseMuscles: exercise },
  });

const musclesOptions = (
  responses: ScriptedResponse[],
  ...answers: ToolAnswer[]
): HarnessOptions => ({
  responses,
  tools: showMusclesTools,
  answers: { show_exercise_muscles: inSequence(...answers) },
});

Deno.test(
  "a shown exercise sends its event after the reply and before done, and stores it under the call's id",
  async () => {
    await withHarness(
      musclesOptions(
        [
          callTools([showMuscles("m1")], "Checking."),
          reply("Romanian deadlift works mainly your hamstrings."),
        ],
        musclesOf(romanianDeadlift),
      ),
      async (harness) => {
        const result = await harness.take("What muscles does a Romanian deadlift work?");

        const types = typesOf(withoutStatus(result.events));
        assertEquals(types.filter((type) => type !== "text").slice(-2), [
          "exercise_muscles",
          "done",
        ]);
        assertEquals(types.lastIndexOf("text") < types.indexOf("exercise_muscles"), true);
        assertEquals(eventsOfType(result.events, "exercise_muscles"), [
          { type: "exercise_muscles", exercise: romanianDeadlift },
        ]);
        const [toolRow] = toolResultRows(harness);
        assertEquals(toolRow?.display, { m1: { exerciseMuscles: romanianDeadlift } });
        assertEquals(await harness.turns.turnHasAction(result.turnId), false);
        assertEquals(typesOf(result.events).includes("answer_meta"), false);
      },
    );
  },
);

Deno.test(
  "parity: the stored thread reads the figure back as the item the live event drew",
  async () => {
    await withHarness(
      musclesOptions(
        [callTools([showMuscles("m1")]), reply("Mainly your hamstrings.")],
        musclesOf(romanianDeadlift),
      ),
      async (harness) => {
        const result = await harness.take("What does a Romanian deadlift work?");

        const live = eventsOfType(result.events, "exercise_muscles").map((event) => event.exercise);
        const stored = threadFromMessages(result.rows, []).flatMap((item) =>
          item.kind === "exercise_muscles" ? [item.exercise] : [],
        );
        assertEquals(stored, live);
        assertEquals(stored.length, 1);
      },
    );
  },
);

Deno.test(
  "two shown exercises send two events in call order and make two items, never merged",
  async () => {
    await withHarness(
      musclesOptions(
        [
          callTools([showMuscles("m1"), showMuscles("m2")]),
          reply("Both count a full set for your hamstrings."),
        ],
        musclesOf(romanianDeadlift),
        musclesOf(legCurl),
      ),
      async (harness) => {
        const result = await harness.take(
          "Which works my hamstrings more, Romanian deadlift or leg curl?",
        );

        assertEquals(
          eventsOfType(result.events, "exercise_muscles").map((event) => event.exercise),
          [romanianDeadlift, legCurl],
        );
        const items = threadFromMessages(result.rows, []).filter(
          (item) => item.kind === "exercise_muscles",
        );
        assertEquals(items.length, 2);
      },
    );
  },
);

Deno.test("a fifth shown exercise answers card_limit and reaches no tool", async () => {
  const calls = ["m1", "m2", "m3", "m4", "m5"].map(showMuscles);
  await withHarness(
    musclesOptions(
      [callTools(calls), reply("Here are four of them. Which others?")],
      ...Array.from({ length: MAX_EXERCISE_MUSCLES_CARDS }, () => musclesOf(legCurl)),
    ),
    async (harness) => {
      const result = await harness.take("What does each exercise in my routine work?");

      assertEquals(MAX_EXERCISE_MUSCLES_CARDS, 4);
      assertEquals(eventsOfType(result.events, "exercise_muscles").length, 4);
      assertEquals(harness.connections[0]?.calls.length, 4);
      const [fifth] = toolResultRows(harness).slice(-1);
      const [block] = blocksOf(fifth?.content);
      assertEquals(block?.["tool_use_id"], "m5");
      assertEquals(block?.["is_error"], true);
      assertStringIncludes(String(block?.["content"]), '"error":"card_limit"');
      assertEquals(fifth?.display, null);
    },
  );
});

Deno.test("a not_found answer draws nothing and does not use up one of the four", async () => {
  const notFound = okResult({ name: "show_exercise_muscles", payload: { error: "not_found" } });
  await withHarness(
    musclesOptions(
      [callTools(["m1", "m2", "m3", "m4", "m5"].map(showMuscles)), reply("Four are shown.")],
      notFound,
      musclesOf(legCurl),
      musclesOf(legCurl),
      musclesOf(legCurl),
      musclesOf(legCurl),
    ),
    async (harness) => {
      const result = await harness.take("What does each of these work?");

      assertEquals(eventsOfType(result.events, "exercise_muscles").length, 4);
      assertEquals(harness.connections[0]?.calls.length, 5);
    },
  );
});

Deno.test("a stopped turn sends no event for the figure it had", async () => {
  let run: ReturnType<Harness["start"]> | undefined;
  await withHarness(
    {
      ...musclesOptions([callTools([showMuscles("m1")]), reply("never asked for")]),
      answers: {
        show_exercise_muscles: async () => {
          await run?.cancel();
          return musclesOf(romanianDeadlift);
        },
      },
    },
    async (harness) => {
      run = harness.start("What does a Romanian deadlift work?");
      const result = await run.finished;

      assertEquals(typesOf(result.events).includes("exercise_muscles"), false);
      assertEquals(turnStatuses(harness), ["stopped"]);
    },
  );
});

Deno.test(
  "a figure that does not parse is reported with fixed words, stored as nothing and not sent",
  async () => {
    const spy = spyOnConsole();
    try {
      await withHarness(
        musclesOptions(
          [callTools([showMuscles("m1")]), reply("Mainly your hamstrings.")],
          okResult({
            name: "show_exercise_muscles",
            structured: {
              exerciseMuscles: {
                exerciseName: "Sentinel Squat",
                muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
              },
            },
          }),
        ),
        async (harness) => {
          const result = await harness.take("What does a squat work?");

          assertEquals(typesOf(result.events).includes("exercise_muscles"), false);
          assertEquals(result.events.at(-1), { type: "done", outcome: "complete" });
          assertEquals(toolResultRows(harness)[0]?.display, null);
          assertEquals(harness.reports.length, 1);
          assertEquals(String(harness.reports[0]?.caught).includes("Sentinel"), false);
        },
      );
    } finally {
      spy.restore();
    }
    assertEquals(spy.lines.join("\n").includes("Sentinel"), false);
  },
);
