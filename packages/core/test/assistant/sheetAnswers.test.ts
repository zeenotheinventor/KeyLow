import { describe, expect, it } from "vitest";

import {
  loggedCard,
  recipeCreatedCard,
  recipeImportCard,
  recipeUnresolvedCard,
} from "./cardFixtures";
import {
  buildAssistantSheetThread,
  canAnswerAssistantQuestion,
  canSendAssistantMessage,
} from "../../src/assistant";

import type {
  AssistantSheetAccess,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

// The words of `assistant · answer`, `assistant · answer-estimate` and `assistant · recipe-reading`.
const PROTEIN_ANSWER =
  "You averaged 126 g of protein a day from Monday 12 to Sunday 18 October. That is 14 g a day under your 140 g target. You reached it on 2 of the 7 days.";
const PROTEIN_CITATION = "Based on 38 entries, 12 to 18 Oct";
const TREND_ANSWER =
  "Your trend weight fell by 0.4 kg a week over the last 4 weeks, from 81.2 kg to 79.6 kg.";
const TREND_ESTIMATE = "Trend weight is an estimate";
const TREND_CITATION = "Based on 24 weigh-ins, 21 Sep to 18 Oct";

const liveTurn = (overrides: Partial<AssistantSheetLiveTurn> = {}): AssistantSheetLiveTurn => ({
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
  answerMeta: null,
  status: null,
  stopped: false,
  notice: null,
  ...overrides,
});

const replyItem = (answerMeta: { citation: string | null; estimate: string | null } | null) =>
  ({ kind: "reply", id: "r1", text: PROTEIN_ANSWER, answerMeta, stopped: false }) as const;

const build = (input: Partial<Parameters<typeof buildAssistantSheetThread>[0]> = {}) =>
  buildAssistantSheetThread({ items: [], sent: null, live: null, isStreaming: false, ...input });

describe("the lines under a stored answer", () => {
  it("should carry the citation exactly as the event sent it", () => {
    const { entries } = build({
      items: [replyItem({ citation: PROTEIN_CITATION, estimate: null })],
    });

    expect(entries).toEqual([
      expect.objectContaining({ kind: "assistant", citation: PROTEIN_CITATION, estimate: null }),
    ]);
  });

  it("should carry the Estimate badge with its line, then the citation", () => {
    const { entries } = build({
      items: [
        {
          ...replyItem({ citation: TREND_CITATION, estimate: TREND_ESTIMATE }),
          text: TREND_ANSWER,
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        paragraphs: [TREND_ANSWER],
        citation: TREND_CITATION,
        estimate: { badgeLabel: "Estimate", label: TREND_ESTIMATE },
      }),
    ]);
  });

  it("should draw neither line when the answer has no meta", () => {
    const { entries } = build({ items: [replyItem(null)] });

    expect(entries).toEqual([expect.objectContaining({ citation: null, estimate: null })]);
  });

  it("should draw only the field the meta holds", () => {
    const { entries } = build({
      items: [replyItem({ citation: null, estimate: TREND_ESTIMATE })],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        citation: null,
        estimate: { badgeLabel: "Estimate", label: TREND_ESTIMATE },
      }),
    ]);
  });
});

describe("the lines under the answer being written", () => {
  const sent = { text: "How much protein did I average last week?", afterItemId: null };

  it("should carry the meta the turn sent", () => {
    const { entries } = build({
      sent,
      live: liveTurn({
        text: PROTEIN_ANSWER,
        answerMeta: { citation: PROTEIN_CITATION, estimate: null },
      }),
      isStreaming: true,
    });

    expect(entries.at(-1)).toMatchObject({
      key: "sent:reply",
      citation: PROTEIN_CITATION,
      estimate: null,
    });
  });

  it("should draw neither line before the meta arrives", () => {
    const { entries } = build({
      sent,
      live: liveTurn({ text: PROTEIN_ANSWER }),
      isStreaming: true,
    });

    expect(entries.at(-1)).toMatchObject({ citation: null, estimate: null });
  });

  it("should carry null fields as no line", () => {
    const { entries } = build({
      sent,
      live: liveTurn({ text: PROTEIN_ANSWER, answerMeta: { citation: null, estimate: null } }),
    });

    expect(entries.at(-1)).toMatchObject({ citation: null, estimate: null });
  });
});

describe("the working line while a recipe page is read", () => {
  const sent = { text: "Add this recipe: https://example.com/lemon-traybake", afterItemId: null };
  const status = { code: "reading_recipe", host: "example.com" } as const;

  it("should draw the line under your message, with no caret before any words", () => {
    const { entries } = build({ sent, live: liveTurn({ status }), isStreaming: true });

    expect(entries).toEqual([
      { kind: "you", key: "sent:you", text: sent.text },
      { kind: "status", key: "sent:status", text: "Reading the recipe at example.com" },
    ]);
  });

  it("should word the host the event names", () => {
    const { entries } = build({
      sent,
      live: liveTurn({ status: { code: "reading_recipe", host: "recipes.example.org" } }),
      isStreaming: true,
    });

    expect(entries.at(-1)).toEqual({
      kind: "status",
      key: "sent:status",
      text: "Reading the recipe at recipes.example.org",
    });
  });

  it("should leave the caret off words that came before the page was read", () => {
    const { entries } = build({
      sent,
      live: liveTurn({ text: "I'll read that page.", status }),
      isStreaming: true,
    });

    expect(entries.map((entry) => entry.kind)).toEqual(["you", "assistant", "status"]);
    expect(entries[1]).toMatchObject({ isStreaming: false });
  });

  it("should be gone once the next event clears the status", () => {
    const { entries } = build({
      sent,
      live: liveTurn({ status: null, cards: [recipeImportCard] }),
      isStreaming: true,
    });

    expect(entries.map((entry) => entry.kind)).toEqual(["you", "card", "assistant"]);
  });

  it("should not be drawn once the turn has ended", () => {
    const { entries } = build({ sent, live: liveTurn({ status }), isStreaming: false });

    expect(entries.map((entry) => entry.kind)).toEqual(["you"]);
  });
});

describe("sending while a recipe page is read", () => {
  const ready = {
    isStreaming: false,
    isOnline: true,
    isThreadKnown: true,
    isThreadFetching: false,
    isReadingRecipe: false,
    access: { kind: "open" } satisfies AssistantSheetAccess,
  };

  it("should not allow a message while the page is read", () => {
    expect(canSendAssistantMessage({ ...ready, text: "Hello", isReadingRecipe: true })).toBe(false);
  });

  it("should not allow a quick reply or a confirm button while the page is read", () => {
    expect(canAnswerAssistantQuestion({ ...ready, isReadingRecipe: true })).toBe(false);
  });

  it("should allow a message again once the page has been read", () => {
    expect(canSendAssistantMessage({ ...ready, text: "Hello" })).toBe(true);
  });
});

describe("the sheet's height for a recipe import", () => {
  const items = (card: typeof recipeImportCard): AssistantThreadItem[] => [
    { kind: "user", id: "u1", text: "Add this recipe: https://example.com/lemon-traybake" },
    { kind: "card", id: "c1", card },
  ];

  it("should ask for full height when the thread holds a recipe import card", () => {
    expect(build({ items: items(recipeImportCard) }).needsFullHeight).toBe(true);
  });

  it("should ask for full height for the card with a line that matched no food", () => {
    expect(build({ items: items(recipeUnresolvedCard) }).needsFullHeight).toBe(true);
  });

  it("should ask for full height when the import card arrives in the turn being written", () => {
    const thread = build({
      sent: { text: "Add this recipe", afterItemId: null },
      live: liveTurn({ cards: [recipeImportCard] }),
      isStreaming: true,
    });

    expect(thread.needsFullHeight).toBe(true);
  });

  it("should keep the open height for a recipe made from typed ingredients", () => {
    expect(build({ items: items(recipeCreatedCard) }).needsFullHeight).toBe(false);
  });

  it("should keep the open height for other cards and for an empty thread", () => {
    expect(build({ items: items(loggedCard) }).needsFullHeight).toBe(false);
    expect(build().needsFullHeight).toBe(false);
  });
});
