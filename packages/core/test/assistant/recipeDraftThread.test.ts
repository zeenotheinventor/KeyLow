import { describe, expect, it } from "vitest";

import {
  firstTurnId,
  replyMessage,
  toolResultMessage,
  toolUseMessage,
  userMessage,
} from "./storedConversations";
import {
  assistantRecipeDraftSchema,
  buildAssistantSheetThread,
  isSentTurnStored,
  threadFromMessages,
} from "../../src/assistant";

import type {
  AssistantRecipeDraft,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const idOf = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const suggestion: AssistantRecipeDraft = {
  variant: "suggestion",
  name: "Chicken and rice",
  servings: 2,
  ingredients: [
    {
      name: "chicken",
      foodId: idOf(1),
      foodName: "Chicken, breast",
      foodSource: "cofid",
      grams: 220,
      beforeGrams: null,
      kcal: 326,
      change: "same",
    },
  ],
  dropped: [],
  perServing: { kcal: 600, protein_g: 45, carbs_g: 60, fat_g: 15 },
  fit: { status: "within", target: { kcal: 600 }, misses: [] },
  steps: ["Cook it."],
};

const adjustment: AssistantRecipeDraft = {
  ...suggestion,
  variant: "adjustment",
  recipeId: idOf(9),
  before: { kcal: 500, protein_g: 30, carbs_g: 60, fat_g: 15 },
};

const storedTurn = (
  results: { toolUseId: string; outcome: unknown }[],
  words?: string,
  status?: "stopped" | "failed",
) => {
  const messages = [
    userMessage("m1", firstTurnId, "A chicken dinner for two"),
    toolUseMessage(
      "m2",
      firstTurnId,
      results.map((result) => ({ id: result.toolUseId, name: "suggest_recipe" })),
    ),
    toolResultMessage(
      "m3",
      firstTurnId,
      results.map((result) => ({ ...result, source: "suggest_recipe" })),
    ),
    ...(words === undefined ? [] : [replyMessage("m4", firstTurnId, words)]),
  ];
  return status === undefined ? messages : messages.map((one) => ({ ...one, turnStatus: status }));
};

describe("threadFromMessages, a recipe the assistant drafted", () => {
  it("should read the draft of a stored tool result back after the reply, so a reopened thread shows the card", () => {
    const thread = threadFromMessages(
      storedTurn([{ toolUseId: "call-1", outcome: { recipeDraft: suggestion } }], "Here it is."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "recipe_draft"]);
    expect(thread[2]).toEqual({ kind: "recipe_draft", id: "m3:0:recipeDraft", draft: suggestion });
  });

  it("should drop a draft this app cannot read and keep the rest of the entry", () => {
    const thread = threadFromMessages(
      storedTurn(
        [
          {
            toolUseId: "call-1",
            outcome: { recipeDraft: { variant: "a_later_variant" }, askAgain: true },
          },
        ],
        "Here it is.",
      ),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "ask_again"]);
  });

  it("should read an older row without the key as a turn with no draft", () => {
    const thread = threadFromMessages(
      storedTurn([{ toolUseId: "call-1", outcome: {} }], "Hm."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply"]);
  });

  it("should read a draft from the stored shape the draft schema wrote", () => {
    const stored: unknown = JSON.parse(
      JSON.stringify(assistantRecipeDraftSchema.parse(suggestion)),
    );
    const thread = threadFromMessages(
      storedTurn([{ toolUseId: "call-1", outcome: { recipeDraft: stored } }], "Words."),
      [],
    );

    expect(thread.at(-1)).toMatchObject({ kind: "recipe_draft", draft: suggestion });
  });
});

const liveTurn = (overrides: Partial<AssistantSheetLiveTurn> = {}): AssistantSheetLiveTurn => ({
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
  answerMeta: null,
  status: null,
  stopped: false,
  notice: null,
  outcome: null,
  ...overrides,
});

const build = (input: Partial<Parameters<typeof buildAssistantSheetThread>[0]> = {}) =>
  buildAssistantSheetThread({ items: [], sent: null, live: null, isStreaming: false, ...input });

const sent = { text: "A chicken dinner for two", afterItemId: null };

const storedItem = (id: string, draft: AssistantRecipeDraft): AssistantThreadItem => ({
  kind: "recipe_draft",
  id,
  draft,
});

describe("buildAssistantSheetThread, a recipe the assistant drafted", () => {
  it("should draw a stored suggestion as an entry of its own", () => {
    expect(build({ items: [storedItem("d1", suggestion)] }).entries).toEqual([
      { kind: "recipeDraft", key: "d1", draft: suggestion },
    ]);
  });

  it("should draw nothing for an adjustment, whose card is the compare view and not this one", () => {
    expect(build({ items: [storedItem("d1", adjustment)] }).entries).toEqual([]);
    expect(
      build({
        sent,
        live: liveTurn({ recipeDrafts: [adjustment], outcome: "complete" }),
      }).entries.map((entry) => entry.kind),
    ).toEqual(["you"]);
  });

  it("should draw the reply of the turn on screen, then its draft", () => {
    const live = liveTurn({
      text: "Here is a dinner.",
      recipeDrafts: [suggestion],
      outcome: "complete",
    });

    const entries = build({ sent, live }).entries;

    expect(entries.map((entry) => [entry.kind, entry.key])).toEqual([
      ["you", "sent:you"],
      ["assistant", "sent:reply"],
      ["recipeDraft", "sent:recipeDraft:0"],
    ]);
  });

  it("should draw a draft that lands while the reply is still streaming", () => {
    const live = liveTurn({ text: "Here is", recipeDrafts: [suggestion] });

    expect(build({ sent, live, isStreaming: true }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "assistant",
      "recipeDraft",
    ]);
  });

  it("should hand the card the same draft object, stored or live, so a memoised card is not drawn again", () => {
    const stored = build({ items: [storedItem("d1", suggestion)] }).entries[0];
    const live = build({ sent, live: liveTurn({ recipeDrafts: [suggestion] }) }).entries[1];

    expect(stored?.kind === "recipeDraft" && stored.draft).toBe(suggestion);
    expect(live?.kind === "recipeDraft" && live.draft).toBe(suggestion);
  });

  it("should ask for the full height sheet, so the ingredients show", () => {
    expect(build({ items: [storedItem("d1", suggestion)] }).needsFullHeight).toBe(true);
    expect(build({ sent, live: liveTurn({ recipeDrafts: [suggestion] }) }).needsFullHeight).toBe(
      true,
    );
    expect(build({ items: [storedItem("d1", adjustment)] }).needsFullHeight).toBe(false);
  });

  it("should count a stored draft as the end of a turn that made no words", () => {
    expect(isSentTurnStored([storedItem("d1", suggestion)], null, { text: "" })).toBe(true);
    expect(isSentTurnStored([storedItem("d1", suggestion)], null, { text: "Words" })).toBe(false);
  });

  it("should offer Ask again under a stopped reply with a draft under it", () => {
    const items: AssistantThreadItem[] = [
      { kind: "user", id: "u1", text: "Hello" },
      { kind: "reply", id: "r1", text: "Partly", answerMeta: null, stopped: true },
      storedItem("d1", suggestion),
    ];

    expect(build({ items }).canAskAgain).toBe(true);
  });
});

describe("buildAssistantSheetThread, the working line of a recipe", () => {
  const tool = (name: string) => ({
    code: "tool" as const,
    tool: name,
    food: null,
    isConfirmed: false,
  });
  const statusOf = (name: string) =>
    build({ sent, live: liveTurn({ status: tool(name) }), isStreaming: true }).entries.at(-1);

  it("should add the long wait hint to the words of a recipe being written", () => {
    expect(statusOf("suggest_recipe")).toEqual({
      kind: "status",
      key: "sent:status",
      text: "Writing a recipe for you",
      hint: { words: "Recipes take longer, up to about 40 seconds.", afterMilliseconds: 8000 },
    });
  });

  it("should add it to adjusting a recipe", () => {
    expect(statusOf("adjust_recipe")).toMatchObject({
      text: "Adjusting the recipe",
      hint: { afterMilliseconds: 8000 },
    });
  });

  it("should leave the line exactly as it was for every other step", () => {
    expect(statusOf("get_palate_profile")).toEqual({
      kind: "status",
      key: "sent:status",
      text: "Reading what you usually eat",
    });
    expect(statusOf("plan_meals")).not.toHaveProperty("hint");
    expect(
      build({
        sent,
        live: liveTurn({ status: { code: "thinking" } }),
        isStreaming: true,
      }).entries.at(-1),
    ).toEqual({ kind: "status", key: "sent:status", text: "Thinking" });
  });
});
