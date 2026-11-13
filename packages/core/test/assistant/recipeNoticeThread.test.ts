import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  firstTurnId,
  replyMessage,
  toolResultMessage,
  toolUseMessage,
  userMessage,
} from "./storedConversations";
import {
  assistantRecipeNoticeSchema,
  assistantRecipeRefusalSchema,
  buildAssistantSheetThread,
  isSentTurnStored,
  threadFromMessages,
} from "../../src/assistant";

import type {
  AssistantRecipeNotice,
  AssistantRecipeRefusal,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const timedOut: AssistantRecipeNotice = { code: "timed_out" };
const refused: AssistantRecipeNotice = { code: "refused" };
const refusal: AssistantRecipeRefusal = {
  recipeName: "Eval porridge bowl",
  nutrient: "protein_g",
  target: 53,
  reached: 17.2,
  reachedKcal: 389.4,
};

const storedTurn = (outcome: unknown, words?: string) => [
  userMessage("m1", firstTurnId, "A chicken dinner for two"),
  toolUseMessage("m2", firstTurnId, [{ id: "call-1", name: "suggest_recipe" }]),
  toolResultMessage("m3", firstTurnId, [
    { toolUseId: "call-1", source: "suggest_recipe", outcome },
  ]),
  ...(words === undefined ? [] : [replyMessage("m4", firstTurnId, words)]),
];

// What a row holds after it has been through JSON, as a reopened thread reads it.
const stored = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("threadFromMessages, a recipe that did not come", () => {
  it("should read a stored notice back after the reply, so a reopened thread shows it", () => {
    const thread = threadFromMessages(
      storedTurn({ recipeNotice: stored(assistantRecipeNoticeSchema.parse(timedOut)) }, "Sorry."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "recipe_notice"]);
    expect(thread[2]).toEqual({
      kind: "recipe_notice",
      id: "m3:0:recipeNotice",
      notice: timedOut,
      canRetry: true,
    });
  });

  it("should read a stored refusal back after the reply", () => {
    const thread = threadFromMessages(
      storedTurn(
        { recipeRefusal: stored(assistantRecipeRefusalSchema.parse(refusal)) },
        "That one can't be done.",
      ),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "recipe_refusal"]);
    expect(thread[2]).toEqual({
      kind: "recipe_refusal",
      id: "m3:0:recipeRefusal",
      refusal,
    });
  });

  it("should not let a stored notice be retried when the same turn wrote something", () => {
    const thread = threadFromMessages(
      storedTurn({ card: loggedCard, recipeNotice: timedOut }, "Logged. The recipe timed out."),
      [],
    );

    expect(thread.find((item) => item.kind === "recipe_notice")).toMatchObject({
      canRetry: false,
    });
  });

  it("should drop a notice this app cannot read and keep the rest of the entry", () => {
    const thread = threadFromMessages(
      storedTurn({ recipeNotice: { code: "a_later_code" }, askAgain: true }, "Sorry."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "ask_again"]);
  });

  it("should drop a refusal this app cannot read", () => {
    const thread = threadFromMessages(
      storedTurn({ recipeRefusal: { recipeName: "Bowl", nutrient: "fibre_g" } }, "Sorry."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply"]);
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

const noticeItem = (id: string, notice: AssistantRecipeNotice): AssistantThreadItem => ({
  kind: "recipe_notice",
  id,
  notice,
  canRetry: true,
});

describe("buildAssistantSheetThread, a recipe notice", () => {
  it("should draw a stored notice as an entry of its own, with the notice it was given", () => {
    expect(build({ items: [noticeItem("n1", timedOut)] }).entries).toEqual([
      { kind: "recipeNotice", key: "n1", notice: timedOut, isLatest: true, canRetry: true },
    ]);
  });

  it("should draw a live notice after the reply", () => {
    const live = liveTurn({ text: "Sorry.", recipeNotices: [timedOut], outcome: "complete" });

    expect(build({ sent, live }).entries.map((entry) => [entry.kind, entry.key])).toEqual([
      ["you", "sent:you"],
      ["assistant", "sent:reply"],
      ["recipeNotice", "sent:recipeNotice:0"],
    ]);
  });

  it("should not let a live notice be retried when the turn drew a card", () => {
    const live = liveTurn({
      text: "Logged.",
      cards: [loggedCard],
      recipeNotices: [timedOut],
      outcome: "complete",
    });
    const entry = build({ sent, live }).entries.find((one) => one.kind === "recipeNotice");

    expect(entry).toMatchObject({ canRetry: false });
  });

  it("should let a live notice be retried when the turn wrote nothing", () => {
    const live = liveTurn({ text: "Sorry.", recipeNotices: [timedOut], outcome: "complete" });
    const entry = build({ sent, live }).entries.find((one) => one.kind === "recipeNotice");

    expect(entry).toMatchObject({ canRetry: true });
  });

  it("should offer the button of the notice at the end of the thread only", () => {
    const items: AssistantThreadItem[] = [
      noticeItem("n1", timedOut),
      { kind: "user", id: "u2", text: "Again" },
      noticeItem("n2", timedOut),
    ];

    expect(
      build({ items }).entries.flatMap((entry) =>
        entry.kind === "recipeNotice" ? [entry.isLatest] : [],
      ),
    ).toEqual([false, true]);
  });

  it("should not treat a notice that follows a stopped reply as the end of that reply", () => {
    const items: AssistantThreadItem[] = [
      { kind: "user", id: "u1", text: "Hello" },
      { kind: "reply", id: "r1", text: "Partly", answerMeta: null, stopped: true },
      noticeItem("n1", refused),
    ];

    expect(build({ items }).canAskAgain).toBe(true);
  });

  it("should end the turn the message sent from the sheet started, when it has no words to wait for", () => {
    const items = [noticeItem("n1", timedOut)];

    expect(isSentTurnStored(items, null, { text: "" })).toBe(true);
    expect(isSentTurnStored(items, null, { text: "Sorry." })).toBe(false);
  });
});

describe("buildAssistantSheetThread, a refused adjustment", () => {
  it("should draw a stored refusal as an entry of its own", () => {
    expect(build({ items: [{ kind: "recipe_refusal", id: "f1", refusal }] }).entries).toEqual([
      { kind: "recipeRefusal", key: "f1", refusal },
    ]);
  });

  it("should draw a live refusal after the reply", () => {
    const live = liveTurn({
      text: "That one can't be done with what is in it.",
      recipeRefusals: [refusal],
      outcome: "complete",
    });

    expect(build({ sent, live }).entries.map((entry) => [entry.kind, entry.key])).toEqual([
      ["you", "sent:you"],
      ["assistant", "sent:reply"],
      ["recipeRefusal", "sent:recipeRefusal:0"],
    ]);
  });

  it("should end the turn the message sent from the sheet started, when it has no words to wait for", () => {
    expect(
      isSentTurnStored([{ kind: "recipe_refusal", id: "f1", refusal }], null, { text: "" }),
    ).toBe(true);
  });
});
