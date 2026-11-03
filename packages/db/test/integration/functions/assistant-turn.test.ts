import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { anthropicMock } from "../support/anthropicMock";
import { callAssistant, eventsOf, newAssistantUser, turnBody } from "../support/assistantClient";
import { requireServedFunction } from "../support/functionsLane";
import { deleteCreatedTestUsers } from "../support/users";

import type { ModelRequestBody, ScriptedReply } from "../support/anthropicMock";
import type { TestUser } from "../support/users";
import type { AssistantStreamEvent } from "@keylow/core";

/*
 * The served path of the turn loop (KEY-795): the served `assistant` function reaching the served `mcp`
 * function through Ki-Lo's real MCP client, with only the Messages API mocked (the mock server, under
 * /anthropic). It proves what the Deno tests with a fake connection cannot: that the events parse with the
 * core schema, that the rows land under the right user, that the usage rows are written, and that the
 * request the model receives holds nothing of the person.
 *
 * Both turns run once in `beforeAll`, each in its own consented user's name and with a marker of its own in
 * the user text, so a parallel suite never receives one of these replies. The user texts never appear in
 * an assertion message.
 */

const markerOf = () => `kl795${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

// Letters only, because the word is searched as text.
const foodWord = `quill${crypto
  .randomUUID()
  .replaceAll("-", "")
  .replace(/[0-9]/g, (digit) => "ghijklmnop"[Number(digit)] ?? "g")}`;

type FinishedTurn = {
  user: TestUser;
  marker: string;
  // The words as sent, marker included.
  sentText: string;
  events: AssistantStreamEvent[];
  requests: ModelRequestBody[];
};

async function runTurn(options: {
  user: TestUser;
  text: string;
  marker: string;
  replies: ScriptedReply[];
}): Promise<FinishedTurn> {
  await anthropicMock.script(options.marker, options.replies);
  const sentText = `${options.text} ${options.marker}`;
  const response = await callAssistant("turn", {
    user: options.user,
    body: turnBody(sentText),
  });
  return {
    user: options.user,
    marker: options.marker,
    sentText,
    events: eventsOf(response),
    requests: await anthropicMock.requests(options.marker),
  };
}

let bystander: TestUser;
let searchTurn: FinishedTurn;
let searchToolUseId: string;
let logTurn: FinishedTurn;
let logToolUseId: string;

const searchReplies = (toolUseId: string): ScriptedReply[] => [
  {
    blocks: [
      { type: "tool_use", id: toolUseId, name: "search_foods", input: { q: foodWord, limit: 5 } },
    ],
    stopReason: "tool_use",
    usage: { input: 500, output: 30, cacheCreation: 300 },
  },
  {
    blocks: [{ type: "text", text: "You have scrambled eggs saved." }],
    stopReason: "end_turn",
    usage: { input: 80, output: 12, cacheRead: 300 },
  },
];

const quickEntryInput = {
  kind: "quick",
  food_id: null,
  portion_id: null,
  count: null,
  grams: null,
  ml: null,
  recipe_id: null,
  servings: null,
  kcal: 250,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  label: "Toast",
  local_date: null,
  time: null,
};

const logReplies = (toolUseId: string): ScriptedReply[] => [
  {
    blocks: [{ type: "tool_use", id: toolUseId, name: "log_entry", input: quickEntryInput }],
    stopReason: "tool_use",
  },
  { blocks: [{ type: "text", text: "Logged your toast." }], stopReason: "end_turn" },
];

async function ownedFood(user: TestUser): Promise<void> {
  const { error } = await user.client.from("foods").insert({
    source: "user",
    owner_id: user.id,
    name: `${foodWord} scrambled eggs`,
    basis: "per_100g",
    kcal: 150,
    protein_g: 10,
    fat_g: 11,
    carbs_g: 1,
    fibre_g: 0,
    micros: {},
  });
  if (error) {
    throw new Error("Could not create a food", { cause: error });
  }
}

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "assistant");
  await requireServedFunction(inject("stack"), "mcp");
  const [searcher, logger] = await Promise.all([
    newAssistantUser("assistant-turn"),
    newAssistantUser("assistant-turn"),
  ]);
  bystander = await newAssistantUser("assistant-turn");
  await ownedFood(searcher);
  searchToolUseId = `toolu_${crypto.randomUUID().replaceAll("-", "")}`;
  logToolUseId = `toolu_${crypto.randomUUID().replaceAll("-", "")}`;
  searchTurn = await runTurn({
    user: searcher,
    text: `Which foods match ${foodWord}?`,
    marker: markerOf(),
    replies: searchReplies(searchToolUseId),
  });
  logTurn = await runTurn({
    user: logger,
    text: "Please log my toast",
    marker: markerOf(),
    replies: logReplies(logToolUseId),
  });
}, 120_000);

afterAll(async () => {
  await Promise.all([
    anthropicMock.forget(searchTurn.marker),
    anthropicMock.forget(logTurn.marker),
  ]);
  await deleteCreatedTestUsers();
});

// ---- Reading what the model was sent and what was stored ----

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const blocksOf = (content: unknown): Record<string, unknown>[] =>
  Array.isArray(content)
    ? content.flatMap((block: unknown) => (isRecord(block) ? [block] : []))
    : [];

function blocksOfMessage(request: ModelRequestBody, index: number): Record<string, unknown>[] {
  const messages = request["messages"];
  const message: unknown = Array.isArray(messages) ? messages[index] : undefined;
  return blocksOf(isRecord(message) ? message["content"] : undefined);
}

async function storedMessages(turn: FinishedTurn) {
  const { data, error } = await turn.user.client
    .from("assistant_messages")
    .select("seq, role, content, display")
    .order("seq", { ascending: true });
  if (error) {
    throw new Error("Could not read the messages", { cause: error });
  }
  return data;
}

const textOf = (event: AssistantStreamEvent) => (event.type === "text" ? event.delta : "");

describe("a turn that calls search_foods and then answers", () => {
  it("streams events that all parse, in the order turn, text, done complete", () => {
    const { events } = searchTurn;

    expect(events[0]?.type).toBe("turn");
    expect(events.at(-1)).toEqual({ type: "done", outcome: "complete" });
    expect(events.slice(1, -1).every(({ type }) => type === "text")).toBe(true);
    expect(events.map(textOf).join("")).toBe("You have scrambled eggs saved.");
  });

  it("sends the model the search_foods result wrapped as untrusted data, in its second request", () => {
    const [first, second] = searchTurn.requests;

    expect(searchTurn.requests).toHaveLength(2);
    expect(first).toBeDefined();
    const results = (second === undefined ? [] : blocksOfMessage(second, 2)).filter(
      (block) => block["type"] === "tool_result",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ tool_use_id: searchToolUseId });
    const content = String(results[0]?.["content"]);
    expect(content).toContain("<untrusted_data");
    // The real tool ran under the caller's own JWT: the user's own food is in the result.
    expect(content).toContain(foodWord);
  });

  it("stores the messages under the user, in seq order", async () => {
    const rows = await storedMessages(searchTurn);

    expect(rows.map(({ role }) => role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(rows.map(({ seq }) => seq)).toEqual(
      [...rows.map(({ seq }) => seq)].sort((a, b) => a - b),
    );
    expect(new Set(rows.map(({ seq }) => seq)).size).toBe(4);
    const [userRow, toolUseRow, toolResultRow, answerRow] = rows;
    // The context block first, the words last.
    const userBlocks = blocksOf(userRow?.content);
    expect(userBlocks).toHaveLength(2);
    expect(String(userBlocks[0]?.["text"])).toMatch(/^Today is /);
    expect(userBlocks[1]).toEqual({ type: "text", text: searchTurn.sentText });
    expect(toolUseRow?.content).toEqual([
      {
        type: "tool_use",
        id: searchToolUseId,
        name: "search_foods",
        input: { q: foodWord, limit: 5 },
      },
    ]);
    const resultBlocks = blocksOf(toolResultRow?.content);
    expect(resultBlocks).toHaveLength(1);
    expect(resultBlocks[0]).toMatchObject({ type: "tool_result", tool_use_id: searchToolUseId });
    expect(answerRow?.content).toEqual([{ type: "text", text: "You have scrambled eggs saved." }]);
  });

  it("ends the turn complete and writes one usage row for each model call on the mcp_http transport", async () => {
    const turns = await searchTurn.user.client.from("assistant_turns").select("id, status");
    const usage = await searchTurn.user.client
      .from("assistant_usage")
      .select(
        "transport, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, stop_reason",
      )
      .order("created_at", { ascending: true });

    expect(turns.data?.map(({ status }) => status)).toEqual(["complete"]);
    expect(usage.data).toEqual([
      {
        transport: "mcp_http",
        model: "claude-haiku-5-5",
        input_tokens: 500,
        output_tokens: 30,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 300,
        stop_reason: "tool_use",
      },
      {
        transport: "mcp_http",
        model: "claude-haiku-5-5",
        input_tokens: 80,
        output_tokens: 12,
        cache_read_input_tokens: 300,
        cache_creation_input_tokens: 0,
        stop_reason: "end_turn",
      },
    ]);
  });

  it("shows another user none of those rows", async () => {
    for (const table of [
      "assistant_conversations",
      "assistant_turns",
      "assistant_messages",
      "assistant_usage",
    ] as const) {
      const { data, error } = await bystander.client.from(table).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});

describe("a turn that calls log_entry", () => {
  it("streams a card event before the words, then done complete", () => {
    const types = logTurn.events.map(({ type }) => type);

    expect(types[0]).toBe("turn");
    expect(types[1]).toBe("card");
    expect(types.slice(2, -1).every((type) => type === "text")).toBe(true);
    expect(logTurn.events.at(-1)).toEqual({ type: "done", outcome: "complete" });
  });

  it("stores the same card in display, keyed by the call, and one action row for the turn", async () => {
    const card = logTurn.events.find((event) => event.type === "card");
    const rows = await storedMessages(logTurn);
    const actions = await logTurn.user.client.from("assistant_actions").select("id, tool, turn_id");

    if (card?.type !== "card") {
      throw new Error("The stream held no card");
    }
    const turnEvent = logTurn.events[0];
    const resultRow = rows.find((row) => row.display !== null);
    expect(resultRow?.display).toEqual({ [logToolUseId]: { card: card.card } });
    expect(actions.data?.map(({ tool }) => tool)).toEqual(["log_entry"]);
    expect(actions.data?.map(({ turn_id }) => turn_id)).toEqual([
      turnEvent?.type === "turn" ? turnEvent.turnId : null,
    ]);
    expect(card.card.actionIds).toEqual(actions.data?.map(({ id }) => id));
  });
});

describe("the requests the model received", () => {
  const allRequests = () => [...searchTurn.requests, ...logTurn.requests];

  // Every key of every object in a body, however deep.
  function keysOf(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap(keysOf);
    }
    return isRecord(value)
      ? Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)])
      : [];
  }

  it("holds neither the user's id nor their email", () => {
    for (const turn of [searchTurn, logTurn]) {
      for (const request of turn.requests) {
        const body = JSON.stringify(request);
        expect(body).not.toContain(turn.user.id);
        expect(body).not.toContain(turn.user.email);
      }
    }
  });

  it("holds no profile field name as a key", () => {
    const profileFields = [
      "activity",
      "assistant_consent_at",
      "assistant_consent_version",
      "birth_date",
      "checkin_weekday",
      "energy_unit",
      "height_cm",
      "onboarding_completed_at",
      "onboarding_weight_kg",
      "sex",
      "target_carbs_g",
      "target_fat_g",
      "target_kcal",
      "target_protein_g",
      "targets_updated_at",
      "terms_accepted_at",
      "terms_version",
      "timezone",
      "weight_unit",
    ];
    const keys = new Set(allRequests().flatMap(keysOf));

    expect(profileFields.filter((field) => keys.has(field))).toEqual([]);
  });

  it("holds no MCP connector, beta, sampling or thinking-budget parameter", () => {
    const forbidden = ["mcp_servers", "betas", "temperature", "top_p", "top_k", "budget_tokens"];
    const keys = new Set(allRequests().flatMap(keysOf));

    expect(forbidden.filter((key) => keys.has(key))).toEqual([]);
  });
});
