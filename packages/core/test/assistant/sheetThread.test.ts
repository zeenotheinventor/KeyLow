import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import { buildAssistantSheetThread, canSendAssistantMessage } from "../../src/assistant";

import type {
  AssistantNotice,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const turnFailed: AssistantNotice = { code: "turn_failed" };

const liveTurn = (overrides: Partial<AssistantSheetLiveTurn> = {}): AssistantSheetLiveTurn => ({
  text: "",
  stopped: false,
  notice: null,
  ...overrides,
});

const storedItems: AssistantThreadItem[] = [
  { kind: "user", id: "u1", text: "2 eggs and toast at 8:10" },
  { kind: "card", id: "c1", card: { ...loggedCard, undo: "available" } },
  { kind: "user", id: "u2", text: "What's left for today?" },
  {
    kind: "reply",
    id: "r2",
    text: "You have 1,693 kcal and 117 g of protein left today.",
    answerMeta: { citation: "Based on 4 entries today and your targets", estimate: null },
    stopped: false,
  },
];

const build = (input: Partial<Parameters<typeof buildAssistantSheetThread>[0]> = {}) =>
  buildAssistantSheetThread({ items: [], sent: null, live: null, isStreaming: false, ...input });

describe("buildAssistantSheetThread", () => {
  describe("a stored conversation", () => {
    it("should draw your messages and the assistant's words and leave out what later tickets draw", () => {
      expect(build({ items: storedItems }).entries).toEqual([
        { kind: "you", key: "u1", text: "2 eggs and toast at 8:10" },
        { kind: "you", key: "u2", text: "What's left for today?" },
        {
          kind: "assistant",
          key: "r2",
          paragraphs: ["You have 1,693 kcal and 117 g of protein left today."],
          isStreaming: false,
          isStopped: false,
        },
      ]);
    });

    it("should leave out a question, a confirmation and the consent notice, never drawing raw data", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "Some chicken" },
        {
          kind: "clarify",
          id: "q1",
          question: "How much?",
          quickReplies: ["100 g"],
          fieldHint: null,
          answered: false,
        },
        {
          kind: "confirm",
          id: "k1",
          confirmationId: "00000000-0000-4000-8000-0000000000a1",
          question: "Delete it?",
          confirmLabel: "Delete",
          cancelLabel: "Keep",
          tone: "danger",
          answered: false,
        },
        { kind: "notice", id: "n1", notice: { code: "consent_needed" } },
      ];

      expect(build({ items }).entries).toEqual([{ kind: "you", key: "u1", text: "Some chicken" }]);
    });

    it("should split a reply into one paragraph for each blank line", () => {
      const items: AssistantThreadItem[] = [
        {
          kind: "reply",
          id: "r",
          text: "First line.\nStill first.\n\nSecond.",
          answerMeta: null,
          stopped: false,
        },
      ];

      expect(build({ items }).entries).toMatchObject([
        { paragraphs: ["First line.\nStill first.", "Second."] },
      ]);
    });

    it("should draw a stored failed turn as a notice, with the button only while it is the last thing", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "Log a flat white at 07:30" },
        { kind: "notice", id: "n1", notice: turnFailed },
      ];
      const [, latest] = build({ items }).entries;
      const [, earlier] = build({
        items: [...items, { kind: "user", id: "u2", text: "Try later" }],
      }).entries;

      expect(latest).toEqual({ kind: "notice", key: "n1", notice: turnFailed, isLatest: true });
      expect(earlier).toMatchObject({ isLatest: false });
    });

    it("should be empty for a person with no conversation", () => {
      expect(build()).toEqual({ entries: [], lastMessage: null, canAskAgain: false });
    });
  });

  describe("a message sent from this sheet", () => {
    const sent = { text: "What did I eat yesterday?", afterItemId: "r2" };

    it("should draw your message and the reply as it arrives, with the caret on", () => {
      const thread = build({
        items: storedItems,
        sent,
        live: liveTurn({ text: "Yesterday, you logged 8 entries" }),
        isStreaming: true,
      });

      expect(thread.entries.slice(-2)).toEqual([
        { kind: "you", key: "sent:you", text: "What did I eat yesterday?" },
        {
          kind: "assistant",
          key: "sent:reply",
          paragraphs: ["Yesterday, you logged 8 entries"],
          isStreaming: true,
          isStopped: false,
        },
      ]);
    });

    it("should draw the caret alone before the first words arrive", () => {
      const thread = build({ sent, live: liveTurn(), isStreaming: true, items: storedItems });

      expect(thread.entries.at(-1)).toMatchObject({ paragraphs: [""], isStreaming: true });
    });

    it("should stop drawing it once the stored conversation has moved on, so nothing shows twice", () => {
      const moved: AssistantThreadItem[] = [
        ...storedItems,
        { kind: "user", id: "u3", text: "What did I eat yesterday?" },
        { kind: "reply", id: "r3", text: "Porridge.", answerMeta: null, stopped: false },
      ];

      expect(
        build({ items: moved, sent, live: liveTurn({ text: "Porridge." }) }).entries,
      ).toHaveLength(5);
    });

    it("should keep drawing the stream when a read during it already holds your message", () => {
      const withYourMessage: AssistantThreadItem[] = [
        ...storedItems,
        { kind: "user", id: "u3", text: "What did I eat yesterday?" },
      ];
      const thread = build({
        items: withYourMessage,
        sent,
        live: liveTurn({ text: "Yesterday, porridge" }),
        isStreaming: true,
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual([
        "u1",
        "u2",
        "r2",
        "sent:you",
        "sent:reply",
      ]);
    });

    it("should draw your first message and its stream once when a read holds it in a conversation that had none", () => {
      const thread = build({
        items: [{ kind: "user", id: "u1", text: "Hello" }],
        sent: { text: "Hello", afterItemId: null },
        live: liveTurn({ text: "Hi" }),
        isStreaming: true,
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual(["sent:you", "sent:reply"]);
    });

    it("should leave the stored conversation to draw the turn once it has ended and the read holds it", () => {
      const thread = build({
        items: [...storedItems, { kind: "user", id: "u3", text: "What did I eat yesterday?" }],
        sent,
        live: liveTurn({ text: "Yesterday, porridge" }),
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual(["u1", "u2", "r2", "u3"]);
    });

    it("should draw a person's first message in a conversation that has no items", () => {
      const thread = build({
        sent: { text: "Hello", afterItemId: null },
        live: liveTurn({ text: "Hi" }),
      });

      expect(thread.entries.map((entry) => entry.kind)).toEqual(["you", "assistant"]);
    });

    it("should keep the arrived words with the stopped mark and offer Ask again for the last message", () => {
      const thread = build({
        items: storedItems,
        sent,
        live: liveTurn({ text: "Yesterday, you logged 8 entries", stopped: true }),
      });

      expect(thread.entries.at(-1)).toMatchObject({ isStopped: true, isStreaming: false });
      expect(thread.canAskAgain).toBe(true);
      expect(thread.lastMessage).toBe("What did I eat yesterday?");
    });

    it("should draw the stopped mark alone when nothing arrived before it was stopped", () => {
      const thread = build({ items: storedItems, sent, live: liveTurn({ stopped: true }) });

      expect(thread.entries.at(-1)).toMatchObject({ paragraphs: [], isStopped: true });
    });

    it("should not offer Ask again while the answer is arriving", () => {
      const thread = build({
        sent,
        live: liveTurn({ text: "Yes", stopped: true }),
        isStreaming: true,
        items: storedItems,
      });

      expect(thread.canAskAgain).toBe(false);
    });

    it("should draw the failed turn's notice with the message to resend", () => {
      const thread = build({
        items: storedItems,
        sent,
        live: liveTurn({ notice: turnFailed }),
      });

      expect(thread.entries.at(-1)).toEqual({
        kind: "notice",
        key: "sent:notice",
        notice: turnFailed,
        isLatest: true,
      });
      expect(thread.lastMessage).toBe("What did I eat yesterday?");
      expect(thread.canAskAgain).toBe(false);
    });

    it("should draw a limit notice that arrived with no words as the notice alone", () => {
      const thread = build({
        sent,
        items: storedItems,
        live: liveTurn({ notice: { code: "switched_off" } }),
      });

      expect(thread.entries.slice(-2).map((entry) => entry.kind)).toEqual(["you", "notice"]);
    });

    it("should leave out a consent notice, which the composer states of a later ticket draw", () => {
      const thread = build({
        items: storedItems,
        sent,
        live: liveTurn({ notice: { code: "consent_needed" } }),
      });

      expect(thread.entries.at(-1)).toMatchObject({ kind: "you", key: "sent:you" });
    });
  });

  describe("a stored stopped reply", () => {
    it("should offer Ask again for the last message when the sheet is opened again", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "What did I eat yesterday?" },
        {
          kind: "reply",
          id: "r1",
          text: "Yesterday, porridge with",
          answerMeta: null,
          stopped: true,
        },
      ];
      const thread = build({ items });

      expect(thread.entries.at(-1)).toMatchObject({ isStopped: true });
      expect(thread.canAskAgain).toBe(true);
      expect(thread.lastMessage).toBe("What did I eat yesterday?");
    });

    it("should not offer Ask again once a later message was answered", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "First" },
        { kind: "reply", id: "r1", text: "Part", answerMeta: null, stopped: true },
        { kind: "user", id: "u2", text: "Second" },
        { kind: "reply", id: "r2", text: "Whole", answerMeta: null, stopped: false },
      ];

      expect(build({ items }).canAskAgain).toBe(false);
    });
  });
});

describe("canSendAssistantMessage", () => {
  const ready = {
    text: "Log a banana",
    isStreaming: false,
    isOnline: true,
    isThreadKnown: true,
    isThreadFetching: false,
  };

  it("should allow a message with words, while online and not streaming", () => {
    expect(canSendAssistantMessage(ready)).toBe(true);
  });

  it("should not allow a blank message", () => {
    expect(canSendAssistantMessage({ ...ready, text: " \n " })).toBe(false);
  });

  it("should not allow a message while an answer is arriving", () => {
    expect(canSendAssistantMessage({ ...ready, isStreaming: true })).toBe(false);
  });

  it("should not allow a message while offline", () => {
    expect(canSendAssistantMessage({ ...ready, isOnline: false })).toBe(false);
  });

  it("should not allow a message before the conversation is read, which would start a new one", () => {
    expect(canSendAssistantMessage({ ...ready, isThreadKnown: false })).toBe(false);
  });

  it("should not allow a message while the conversation is being read again", () => {
    expect(canSendAssistantMessage({ ...ready, isThreadFetching: true })).toBe(false);
  });
});
