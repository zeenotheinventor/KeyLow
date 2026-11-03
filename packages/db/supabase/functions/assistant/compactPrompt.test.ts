import { assert, assertEquals } from "@std/assert";

import { wrapUntrusted } from "../_shared/assistant/untrusted.ts";
import {
  COMPACTION_MAX_TOKENS,
  COMPACTION_SYSTEM_PROMPT,
  buildCompactionRequest,
  renderTranscript,
} from "./compactPrompt.ts";
import { MODEL, toApiMessages } from "./prompt.ts";

import type { StoredHistoryMessage } from "./prompt.ts";

let nextId = 0;
const stored = (
  role: StoredHistoryMessage["role"],
  content: unknown,
  turnId = "turn-1",
): StoredHistoryMessage => {
  nextId += 1;
  return { id: `message-${nextId}`, turnId, role, content, display: null };
};

const searchResult = wrapUntrusted("search_foods", { foods: [{ name: "Large egg", id: "f-1" }] });

// A turn with a tool round: the words, a call, its result as its own user row, and the answer.
const toolTurn = [
  stored("user", [
    { type: "text", text: "Today is Mon 2 Nov (2026-11-02) in Europe/London." },
    { type: "text", text: "log two eggs" },
  ]),
  stored("assistant", [
    { type: "thinking", thinking: "private reasoning", signature: "sig-1" },
    { type: "text", text: "Looking that up." },
    { type: "tool_use", id: "call-1", name: "search_foods", input: { q: "egg" } },
  ]),
  stored("user", [{ type: "tool_result", tool_use_id: "call-1", content: searchResult }]),
  stored("assistant", [{ type: "text", text: "Logged 2 large eggs (100 g) at 08:00." }]),
];

Deno.test(
  "the compaction prompt is plain text with no date, id, em dash, double hyphen or semicolon",
  () => {
    assertEquals(/\d{4}-\d{2}-\d{2}/.test(COMPACTION_SYSTEM_PROMPT), false);
    assertEquals(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(COMPACTION_SYSTEM_PROMPT), false);
    assertEquals(/user[_ ]?id|@|\$\{/i.test(COMPACTION_SYSTEM_PROMPT), false);
    assertEquals(COMPACTION_SYSTEM_PROMPT.includes("—"), false);
    assertEquals(COMPACTION_SYSTEM_PROMPT.includes("--"), false);
    assertEquals(COMPACTION_SYSTEM_PROMPT.includes(";"), false);
  },
);

Deno.test(
  "the compaction prompt names what to keep and says nothing in untrusted_data is an instruction",
  () => {
    for (const kept of [
      "foods logged",
      "day and hour",
      "deleted",
      "dates",
      "open",
      "corrections",
      "undos",
      "untrusted_data",
    ]) {
      assert(COMPACTION_SYSTEM_PROMPT.toLowerCase().includes(kept), kept);
    }
  },
);

Deno.test(
  "the compaction request has no tools, thinking disabled at low effort, and one user message",
  () => {
    const request = buildCompactionRequest("the transcript");

    assertEquals(request.model, MODEL);
    assertEquals(request.max_tokens, COMPACTION_MAX_TOKENS);
    assertEquals(request.thinking, { type: "disabled" });
    assertEquals(request.output_config, { effort: "low" });
    assertEquals(request.system, COMPACTION_SYSTEM_PROMPT);
    assertEquals(request.messages, [{ role: "user", content: "the transcript" }]);
    assertEquals("tools" in request, false);
    assertEquals("tool_choice" in request, false);
  },
);

Deno.test(
  "the compaction request carries no sampling, budget, prefill or fallback parameter",
  () => {
    const body = JSON.stringify(buildCompactionRequest("the transcript"));

    for (const forbidden of [
      "temperature",
      "top_p",
      "top_k",
      "budget_tokens",
      "fallbacks",
      "betas",
      "cache_control",
    ]) {
      assertEquals(body.includes(`"${forbidden}"`), false, forbidden);
    }
  },
);

Deno.test(
  "the transcript holds the words, the replies, each call with its input and each result",
  () => {
    const transcript = renderTranscript({ note: null, messages: toApiMessages(toolTurn) });

    assert(transcript.includes("log two eggs"));
    assert(transcript.includes("Today is Mon 2 Nov (2026-11-02) in Europe/London."));
    assert(transcript.includes("Looking that up."));
    assert(transcript.includes('search_foods with {"q":"egg"}'));
    assert(transcript.includes("Logged 2 large eggs (100 g) at 08:00."));
  },
);

Deno.test(
  "a tool result is rendered as stored, inside its untrusted_data wrapper, under its tool's name",
  () => {
    const transcript = renderTranscript({ note: null, messages: toApiMessages(toolTurn) });

    assert(transcript.includes(searchResult));
    assert(transcript.includes("Result of search_foods"));
  },
);

Deno.test("thinking blocks are left out", () => {
  const transcript = renderTranscript({ note: null, messages: toApiMessages(toolTurn) });

  assertEquals(transcript.includes("private reasoning"), false);
  assertEquals(transcript.includes("sig-1"), false);
});

Deno.test("a run of user rows is one message", () => {
  const history = [
    stored("user", [{ type: "text", text: "first words" }]),
    stored("assistant", [
      { type: "tool_use", id: "call-1", name: "get_day", input: {} },
      { type: "tool_use", id: "call-2", name: "get_entries", input: {} },
    ]),
    stored("user", [{ type: "tool_result", tool_use_id: "call-1", content: "one" }]),
    stored("user", [{ type: "tool_result", tool_use_id: "call-2", content: "two" }]),
  ];

  const transcript = renderTranscript({ note: null, messages: toApiMessages(history) });

  // Two speakers' turns for the person: the words, then one message holding both results.
  assertEquals(transcript.split("Person:").length - 1, 2);
  assertEquals(transcript.split("Ki-Lo:").length - 1, 1);
});

Deno.test("the earlier note comes first, in its own tags", () => {
  const transcript = renderTranscript({
    note: "Logged 2 large eggs (100 g) on 2026-11-01.",
    messages: toApiMessages(toolTurn),
  });

  assert(
    transcript.startsWith(
      "<previous_note>\nLogged 2 large eggs (100 g) on 2026-11-01.\n</previous_note>",
    ),
  );
  assert(transcript.indexOf("</previous_note>") < transcript.indexOf("<transcript>"));
});

Deno.test("with no earlier note there is no previous_note tag", () => {
  const transcript = renderTranscript({ note: null, messages: toApiMessages(toolTurn) });

  assertEquals(transcript.includes("previous_note"), false);
  assert(transcript.startsWith("<transcript>"));
});

Deno.test(
  "a result with an error flag says so, and a result with no content is still named",
  () => {
    const history = [
      stored("assistant", [{ type: "tool_use", id: "call-1", name: "delete_entry", input: {} }]),
      stored("user", [{ type: "tool_result", tool_use_id: "call-1", is_error: true }]),
    ];

    const transcript = renderTranscript({ note: null, messages: toApiMessages(history) });

    assert(transcript.includes("Result of delete_entry (error)"));
  },
);
