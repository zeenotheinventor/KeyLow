import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  buildAssistantSheetThread,
  canSendAssistantMessage,
  describeAssistantComposer,
  isAssistantStatusKnown,
  isSentTurnStored,
  isStaleStreamGateNotice,
  resolveAssistantSheetAccess,
  resolveAssistantTimeZone,
} from "../../src/assistant";

import type {
  AssistantNotice,
  AssistantSheetAccess,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const turnFailed: AssistantNotice = { code: "turn_failed" };

const liveTurn = (overrides: Partial<AssistantSheetLiveTurn> = {}): AssistantSheetLiveTurn => ({
  text: "",
  cards: [],
  clarify: null,
  confirm: null,
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
    it("should draw your messages, the assistant's words and its cards, and leave out what later tickets draw", () => {
      expect(build({ items: storedItems }).entries).toEqual([
        { kind: "you", key: "u1", text: "2 eggs and toast at 8:10" },
        { kind: "card", key: "c1", card: { ...loggedCard, undo: "available" } },
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

    it("should leave out the consent notice, never drawing raw data", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "Some chicken" },
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
      expect(build()).toEqual({
        entries: [],
        lastMessage: null,
        canAskAgain: false,
        fieldHint: null,
      });
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
      ).toHaveLength(6);
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
        "c1",
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

    it("should keep drawing the reply after the stream ends while the read holds only your message, so it does not vanish", () => {
      const thread = build({
        items: [...storedItems, { kind: "user", id: "u3", text: "What did I eat yesterday?" }],
        sent,
        live: liveTurn({ text: "Yesterday, porridge" }),
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual([
        "u1",
        "c1",
        "u2",
        "r2",
        "sent:you",
        "sent:reply",
      ]);
    });

    it("should leave the stored conversation to draw the turn once it holds a reply after the message", () => {
      const thread = build({
        items: [
          ...storedItems,
          { kind: "user", id: "u3", text: "What did I eat yesterday?" },
          { kind: "reply", id: "r3", text: "Porridge.", answerMeta: null, stopped: false },
        ],
        sent,
        live: liveTurn({ text: "Porridge." }),
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual([
        "u1",
        "c1",
        "u2",
        "r2",
        "u3",
        "r3",
      ]);
    });

    it("should keep drawing the reply when a read during the stream holds your message and the card but not the reply yet", () => {
      const thread = build({
        items: [
          ...storedItems,
          { kind: "user", id: "u3", text: "Log a banana" },
          { kind: "card", id: "c3", card: loggedCard },
        ],
        sent,
        live: liveTurn({ cards: [loggedCard], text: "Done." }),
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual([
        "u1",
        "c1",
        "u2",
        "r2",
        "sent:you",
        "sent:card:0",
        "sent:reply",
      ]);
    });

    it("should leave the stored conversation to draw a turn that made a card and no words", () => {
      const thread = build({
        items: [
          ...storedItems,
          { kind: "user", id: "u3", text: "Log a banana" },
          { kind: "card", id: "c3", card: loggedCard },
        ],
        sent,
        live: liveTurn({ cards: [loggedCard] }),
      });

      expect(thread.entries.map((entry) => entry.key)).toEqual([
        "u1",
        "c1",
        "u2",
        "r2",
        "u3",
        "c3",
      ]);
    });

    it("should draw a card that arrived in the stream between your message and the reply", () => {
      const thread = build({
        items: storedItems,
        sent,
        live: liveTurn({ cards: [loggedCard], text: "Done." }),
        isStreaming: true,
      });

      expect(thread.entries.slice(-3)).toEqual([
        { kind: "you", key: "sent:you", text: "What did I eat yesterday?" },
        { kind: "card", key: "sent:card:0", card: loggedCard },
        expect.objectContaining({ kind: "assistant", key: "sent:reply" }),
      ]);
    });

    it("should draw a card that arrived alone, with no reply words after it", () => {
      const thread = build({ items: storedItems, sent, live: liveTurn({ cards: [loggedCard] }) });

      expect(thread.entries.slice(-2).map((entry) => entry.kind)).toEqual(["you", "card"]);
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

describe("buildAssistantSheetThread with a question", () => {
  const CONFIRMATION_ID = "00000000-0000-4000-8000-0000000000a1";
  const CLARIFY_QUESTION = "How much chicken and how much rice? Pick one, or say it your way.";
  const QUICK_REPLIES = [
    "1 chicken breast, 150 g rice",
    "1 chicken breast, 200 g rice",
    "2 chicken thighs, 200 g rice",
  ];
  const DELETE_QUESTION =
    "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and an apple.";

  type ClarifyItem = Extract<AssistantThreadItem, { kind: "clarify" }>;
  const clarifyItem = (overrides: Partial<ClarifyItem> = {}): ClarifyItem => ({
    kind: "clarify",
    id: "q1",
    question: CLARIFY_QUESTION,
    quickReplies: QUICK_REPLIES,
    fieldHint: "Or say it your way",
    answered: false,
    ...overrides,
  });
  const confirmItem = (answered = false): AssistantThreadItem => ({
    kind: "confirm",
    id: "k1",
    confirmationId: CONFIRMATION_ID,
    question: DELETE_QUESTION,
    confirmLabel: "Delete 3 entries",
    cancelLabel: "Keep them",
    tone: "danger",
    answered,
  });
  const askedItems = (question: AssistantThreadItem): AssistantThreadItem[] => [
    { kind: "user", id: "u1", text: "Some chicken and rice for lunch" },
    question,
  ];
  const deleteReply: AssistantThreadItem = {
    kind: "reply",
    id: "r1",
    text: DELETE_QUESTION,
    answerMeta: null,
    stopped: false,
  };

  describe("a stored clarifying question", () => {
    it("should draw the question as the assistant's words, then its quick replies as sent", () => {
      expect(build({ items: askedItems(clarifyItem()) }).entries).toEqual([
        { kind: "you", key: "u1", text: "Some chicken and rice for lunch" },
        {
          kind: "assistant",
          key: "q1:question",
          paragraphs: [CLARIFY_QUESTION],
          isStreaming: false,
          isStopped: false,
        },
        { kind: "quickReplies", key: "q1", options: QUICK_REPLIES, isAnswered: false },
      ]);
    });

    it("should draw the quick replies as answered once a later turn exists", () => {
      expect(
        build({ items: askedItems(clarifyItem({ answered: true })) }).entries.at(-1),
      ).toMatchObject({
        kind: "quickReplies",
        isAnswered: true,
      });
    });

    it("should draw the question and no quick replies when it offers none", () => {
      const items = askedItems(clarifyItem({ quickReplies: [] }));

      expect(build({ items }).entries.map((entry) => entry.kind)).toEqual(["you", "assistant"]);
    });

    it("should draw the question once when the model's reply before it says the same words", () => {
      const items: AssistantThreadItem[] = [
        { kind: "user", id: "u1", text: "Some chicken and rice for lunch" },
        { kind: "reply", id: "r1", text: CLARIFY_QUESTION, answerMeta: null, stopped: false },
        clarifyItem(),
      ];

      expect(build({ items }).entries.map((entry) => entry.kind)).toEqual([
        "you",
        "assistant",
        "quickReplies",
      ]);
    });
  });

  describe("a stored confirmation", () => {
    it("should draw the question once, with the buttons as sent, when the reply before it asked it", () => {
      const items = [...askedItems(deleteReply), confirmItem()];

      expect(build({ items }).entries).toEqual([
        { kind: "you", key: "u1", text: "Some chicken and rice for lunch" },
        {
          kind: "assistant",
          key: "r1",
          paragraphs: [DELETE_QUESTION],
          isStreaming: false,
          isStopped: false,
        },
        {
          kind: "confirm",
          key: "k1",
          confirmLabel: "Delete 3 entries",
          cancelLabel: "Keep them",
          tone: "danger",
          isAnswered: false,
        },
      ]);
    });

    it("should draw the question itself when no reply before it says the same words", () => {
      expect(
        build({ items: askedItems(confirmItem()) }).entries.map((entry) => entry.kind),
      ).toEqual(["you", "assistant", "confirm"]);
    });

    it("should draw the buttons as answered once a later turn exists", () => {
      expect(build({ items: askedItems(confirmItem(true)) }).entries.at(-1)).toMatchObject({
        kind: "confirm",
        isAnswered: true,
      });
    });
  });

  describe("a question in the turn being written", () => {
    const sent = { text: "Some chicken and rice for lunch", afterItemId: null };

    it("should draw a live clarifying question with its quick replies, not yet answered", () => {
      const thread = build({
        sent,
        live: liveTurn({
          clarify: {
            question: CLARIFY_QUESTION,
            quickReplies: QUICK_REPLIES,
            fieldHint: "Or say it your way",
          },
        }),
      });

      expect(thread.entries).toEqual([
        { kind: "you", key: "sent:you", text: "Some chicken and rice for lunch" },
        {
          kind: "assistant",
          key: "sent:clarify:question",
          paragraphs: [CLARIFY_QUESTION],
          isStreaming: false,
          isStopped: false,
        },
        { kind: "quickReplies", key: "sent:clarify", options: QUICK_REPLIES, isAnswered: false },
      ]);
    });

    it("should draw a live confirmation's question once, from the reply that asked it", () => {
      const thread = build({
        sent,
        live: liveTurn({
          text: DELETE_QUESTION,
          confirm: {
            question: DELETE_QUESTION,
            confirmLabel: "Delete 3 entries",
            cancelLabel: "Keep them",
            tone: "danger",
          },
        }),
      });

      expect(thread.entries.map((entry) => entry.kind)).toEqual(["you", "assistant", "confirm"]);
      expect(thread.entries[2]).toEqual({
        kind: "confirm",
        key: "sent:confirm",
        confirmLabel: "Delete 3 entries",
        cancelLabel: "Keep them",
        tone: "danger",
        isAnswered: false,
      });
    });
  });

  describe("the message that answers a question", () => {
    it("should draw the stored question's buttons as answered while the next turn is drawn", () => {
      const items = askedItems(clarifyItem());
      const thread = build({
        items,
        sent: { text: "1 chicken breast, 200 g rice", afterItemId: "q1" },
        live: liveTurn(),
        isStreaming: true,
      });

      expect(thread.entries.find((entry) => entry.kind === "quickReplies")).toMatchObject({
        isAnswered: true,
      });
      expect(thread.entries.at(-1)).toMatchObject({ kind: "assistant", isStreaming: true });
    });

    it("should draw a stored confirmation's buttons as answered while the next turn is drawn", () => {
      const thread = build({
        items: askedItems(confirmItem()),
        sent: { text: "Keep them", afterItemId: "k1" },
        live: liveTurn(),
        isStreaming: true,
      });

      expect(thread.entries.find((entry) => entry.kind === "confirm")).toMatchObject({
        isAnswered: true,
      });
    });
  });

  describe("the field hint", () => {
    it("should be the question's while it waits for an answer", () => {
      expect(build({ items: askedItems(clarifyItem()) }).fieldHint).toBe("Or say it your way");
    });

    it("should be none once it is answered", () => {
      expect(build({ items: askedItems(clarifyItem({ answered: true })) }).fieldHint).toBeNull();
    });

    it("should be none for a confirmation, which has no field hint", () => {
      expect(build({ items: askedItems(confirmItem()) }).fieldHint).toBeNull();
    });

    it("should be none for a question with no field hint", () => {
      const items = askedItems(clarifyItem({ fieldHint: null }));

      expect(build({ items }).fieldHint).toBeNull();
    });

    it("should be the live question's", () => {
      const thread = build({
        sent: { text: "Some chicken", afterItemId: null },
        live: liveTurn({
          clarify: {
            question: CLARIFY_QUESTION,
            quickReplies: [],
            fieldHint: "Or say it your way",
          },
        }),
      });

      expect(thread.fieldHint).toBe("Or say it your way");
    });

    it("should be none for a conversation with no question", () => {
      expect(build({ items: storedItems }).fieldHint).toBeNull();
    });
  });
});

describe("buildAssistantSheetThread with the notice that limits the assistant now", () => {
  const plus = { code: "plus" } as const;
  const dayLimit = { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" } as const;

  it("should draw the notice under the earlier messages, as the latest", () => {
    const { entries } = build({ items: storedItems, accessNotice: dayLimit });

    expect(entries.map((entry) => entry.kind)).toEqual([
      "you",
      "card",
      "you",
      "assistant",
      "notice",
    ]);
    expect(entries.at(-1)).toMatchObject({ kind: "notice", notice: dayLimit, isLatest: true });
  });

  it("should draw the notice alone for a conversation with no messages", () => {
    expect(build({ accessNotice: plus }).entries).toEqual([
      { kind: "notice", key: "access:notice", notice: plus, isLatest: true },
    ]);
  });

  it("should not draw it twice when the stored thread already ends in it", () => {
    const items: AssistantThreadItem[] = [
      { kind: "user", id: "u1", text: "Hello" },
      { kind: "notice", id: "n1", notice: dayLimit },
    ];

    expect(build({ items, accessNotice: dayLimit }).entries.map((entry) => entry.key)).toEqual([
      "u1",
      "n1",
    ]);
  });

  it("should draw today's day limit under yesterday's, which resets at another instant", () => {
    const yesterdays = { code: "day_limit", resetsAt: "2026-10-25T00:00:00Z" } as const;
    const items: AssistantThreadItem[] = [{ kind: "notice", id: "n1", notice: yesterdays }];

    expect(build({ items, accessNotice: dayLimit }).entries.map((entry) => entry.key)).toEqual([
      "n1",
      "access:notice",
    ]);
  });

  it("should not draw it twice when the turn on screen ended in it", () => {
    const entries = build({
      items: [],
      sent: { text: "Hello", afterItemId: null },
      live: liveTurn({ notice: dayLimit }),
      accessNotice: dayLimit,
    }).entries;

    expect(entries.map((entry) => entry.key)).toEqual(["sent:you", "sent:notice"]);
  });

  it("should draw nothing extra when there is no such notice", () => {
    expect(build({ items: storedItems, accessNotice: null }).entries).toHaveLength(4);
  });
});

describe("canSendAssistantMessage", () => {
  const ready = {
    text: "Log a banana",
    isStreaming: false,
    isOnline: true,
    isThreadKnown: true,
    isThreadFetching: false,
    access: { kind: "open" } satisfies AssistantSheetAccess,
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

  it.each([
    { name: "the consent card", access: { kind: "consent" } },
    { name: "a day limit", access: { kind: "limited", notice: { code: "plus" } } },
    { name: "a status still being read", access: { kind: "checking" } },
  ] as const)("should not allow a message under $name", ({ access }) => {
    expect(canSendAssistantMessage({ ...ready, access })).toBe(false);
  });
});

describe("resolveAssistantSheetAccess", () => {
  const resolve = (input: Partial<Parameters<typeof resolveAssistantSheetAccess>[0]> = {}) =>
    resolveAssistantSheetAccess({
      statusNotice: null,
      isStatusKnown: true,
      streamNotice: null,
      ...input,
    });
  const dayLimit: AssistantNotice = { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" };

  it("should be checking until the status is known", () => {
    expect(resolve({ isStatusKnown: false })).toEqual({ kind: "checking" });
  });

  it("should be open when the status has no notice", () => {
    expect(resolve()).toEqual({ kind: "open" });
  });

  it("should be the consent card when consent is needed", () => {
    expect(resolve({ statusNotice: { code: "consent_needed" } })).toEqual({ kind: "consent" });
  });

  it.each([
    dayLimit,
    { code: "plus" },
    { code: "resting", resumesOn: "2026-11-01" },
    { code: "switched_off" },
  ] as const)("should be limited by the $code notice", (notice) => {
    expect(resolve({ statusNotice: notice })).toEqual({ kind: "limited", notice });
  });

  it("should stay open for a failed turn, which leaves the composer on", () => {
    expect(resolve({ statusNotice: turnFailed })).toEqual({ kind: "open" });
  });

  it("should take a limit that arrived in the stream over an open status", () => {
    expect(resolve({ streamNotice: dayLimit })).toEqual({ kind: "limited", notice: dayLimit });
  });

  it("should take a limit that arrived in the stream before the status is known", () => {
    expect(resolve({ isStatusKnown: false, streamNotice: dayLimit })).toEqual({
      kind: "limited",
      notice: dayLimit,
    });
  });

  it("should take the stream's notice over the status's", () => {
    expect(resolve({ statusNotice: { code: "plus" }, streamNotice: dayLimit })).toEqual({
      kind: "limited",
      notice: dayLimit,
    });
  });

  it("should show the consent card for consent that was withdrawn mid-conversation", () => {
    expect(resolve({ streamNotice: { code: "consent_needed" } })).toEqual({ kind: "consent" });
  });

  it("should leave a failed turn in the stream to the status", () => {
    expect(resolve({ statusNotice: { code: "plus" }, streamNotice: turnFailed })).toEqual({
      kind: "limited",
      notice: { code: "plus" },
    });
  });
});

describe("describeAssistantComposer", () => {
  const describeComposer = (access: AssistantSheetAccess, isOnline = true) =>
    describeAssistantComposer({ access, isOnline, timeZone: "Europe/London" });

  it("should be on with the sheet's own words when open", () => {
    expect(describeComposer({ kind: "open" })).toEqual({
      isShown: true,
      isFieldDisabled: false,
      placeholder: "Log food or ask about your diary",
    });
  });

  it("should be off with the offline words while offline", () => {
    expect(describeComposer({ kind: "open" }, false)).toEqual({
      isShown: true,
      isFieldDisabled: true,
      placeholder: "Needs a connection",
    });
  });

  it.each([
    { notice: { code: "day_limit", resetsAt: "2026-07-02T00:00:00Z" }, words: "Back at 1 am" },
    { notice: { code: "plus" }, words: "Not on your account" },
    { notice: { code: "resting", resumesOn: "2026-11-01" }, words: "Back on 1 November" },
    { notice: { code: "switched_off" }, words: "Switched off for now" },
  ] as const)("should be off with the $notice.code words when limited", ({ notice, words }) => {
    expect(describeComposer({ kind: "limited", notice })).toEqual({
      isShown: true,
      isFieldDisabled: true,
      placeholder: words,
    });
  });

  it("should say the field hint of a question waiting for an answer, in place of the sheet's words", () => {
    expect(
      describeAssistantComposer({
        access: { kind: "open" },
        isOnline: true,
        timeZone: "Europe/London",
        fieldHint: "Or say it your way",
      }),
    ).toEqual({ isShown: true, isFieldDisabled: false, placeholder: "Or say it your way" });
  });

  it("should keep the offline words over a field hint while offline", () => {
    expect(
      describeAssistantComposer({
        access: { kind: "open" },
        isOnline: false,
        timeZone: "Europe/London",
        fieldHint: "Or say it your way",
      }),
    ).toMatchObject({ placeholder: "Needs a connection" });
  });

  it.each([{ kind: "consent" }, { kind: "checking" }] as const)(
    "should not be shown for $kind",
    (access) => {
      expect(describeComposer(access)).toEqual({ isShown: false });
    },
  );
});

describe("resolveAssistantTimeZone", () => {
  it("should be the profile's zone when it has one", () => {
    expect(resolveAssistantTimeZone("Asia/Tokyo", "Europe/London")).toBe("Asia/Tokyo");
  });

  it("should be the device's until the profile is read", () => {
    expect(resolveAssistantTimeZone(undefined, "Europe/London")).toBe("Europe/London");
  });

  it("should be UTC for a profile with no zone, as logging reads it", () => {
    expect(resolveAssistantTimeZone(null, "Europe/London")).toBe("UTC");
  });
});

describe("isStaleStreamGateNotice", () => {
  it.each([
    { code: "consent_needed" },
    { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
    { code: "plus" },
    { code: "resting", resumesOn: "2026-11-01" },
    { code: "switched_off" },
  ] as const)(
    "should call the $code notice left by a finished turn stale, once the status is read again",
    (streamNotice) => {
      expect(isStaleStreamGateNotice({ streamNotice, isStreaming: false })).toBe(true);
    },
  );

  it("should keep a failed turn, which offers Try again and holds no gate", () => {
    expect(isStaleStreamGateNotice({ streamNotice: turnFailed, isStreaming: false })).toBe(false);
  });

  it("should keep a notice while its turn is still streaming", () => {
    expect(isStaleStreamGateNotice({ streamNotice: { code: "plus" }, isStreaming: true })).toBe(
      false,
    );
  });

  it("should have nothing to call stale without a notice", () => {
    expect(isStaleStreamGateNotice({ streamNotice: null, isStreaming: false })).toBe(false);
  });
});

describe("isAssistantStatusKnown", () => {
  const unread = { isSuccess: false, isError: false, failureCount: 0, isOnline: true };

  it("should not be known while the first read is under way", () => {
    expect(isAssistantStatusKnown(unread)).toBe(false);
  });

  it.each([
    { name: "a read that succeeded", change: { isSuccess: true } },
    { name: "a read that failed for good", change: { isError: true } },
    {
      name: "a read that has failed once and is being tried again, which takes seconds",
      change: { failureCount: 1 },
    },
    { name: "an app that is offline, where the read cannot run", change: { isOnline: false } },
  ])("should be known for $name", ({ change }) => {
    expect(isAssistantStatusKnown({ ...unread, ...change })).toBe(true);
  });
});

describe("isSentTurnStored", () => {
  const user = (id: string): AssistantThreadItem => ({ kind: "user", id, text: "Hello" });
  const reply = (id: string): AssistantThreadItem => ({
    kind: "reply",
    id,
    text: "Hi",
    answerMeta: null,
    stopped: false,
  });
  const card = (id: string): AssistantThreadItem => ({ kind: "card", id, card: loggedCard });
  const withWords = { text: "Done." };
  const withoutWords = { text: "" };

  it("should not hold the turn while the only item after the message is your own", () => {
    expect(isSentTurnStored([reply("r1"), user("u2")], "r1", withWords)).toBe(false);
  });

  it("should hold the turn once a reply follows the message", () => {
    expect(isSentTurnStored([reply("r1"), user("u2"), reply("r2")], "r1", withWords)).toBe(true);
  });

  it("should hold the turn once a notice follows the message", () => {
    expect(
      isSentTurnStored(
        [reply("r1"), user("u2"), { kind: "notice", id: "n2", notice: turnFailed }],
        "r1",
        withoutWords,
      ),
    ).toBe(true);
  });

  const clarify = (id: string): AssistantThreadItem => ({
    kind: "clarify",
    id,
    question: "How much?",
    quickReplies: ["100 g"],
    fieldHint: null,
    answered: false,
  });
  const confirm = (id: string): AssistantThreadItem => ({
    kind: "confirm",
    id,
    confirmationId: "00000000-0000-4000-8000-0000000000a1",
    question: "Delete it?",
    confirmLabel: "Delete",
    cancelLabel: "Keep",
    tone: "danger",
    answered: false,
  });

  it("should hold a clarify-only turn on an empty conversation, which ends in the question", () => {
    expect(isSentTurnStored([user("u1"), clarify("q1")], null, withoutWords)).toBe(true);
  });

  it("should hold a confirm-only turn on an empty conversation, which ends in the question", () => {
    expect(isSentTurnStored([user("u1"), confirm("k1")], null, withoutWords)).toBe(true);
  });

  it("should hold a clarify or confirm turn that follows earlier items", () => {
    expect(isSentTurnStored([reply("r1"), user("u2"), clarify("q2")], "r1", withoutWords)).toBe(
      true,
    );
    expect(isSentTurnStored([reply("r1"), user("u2"), confirm("k2")], "r1", withoutWords)).toBe(
      true,
    );
  });

  it("should not hold the turn on a card alone while the turn has words to come", () => {
    expect(isSentTurnStored([reply("r1"), user("u2"), card("c2")], "r1", withWords)).toBe(false);
  });

  it("should hold a turn that made a card and no words on the card, because no reply will be stored", () => {
    expect(isSentTurnStored([reply("r1"), user("u2"), card("c2")], "r1", withoutWords)).toBe(true);
    expect(isSentTurnStored([reply("r1"), user("u2"), card("c2")], "r1", null)).toBe(true);
  });

  it("should treat words of spaces as no words", () => {
    expect(isSentTurnStored([reply("r1"), user("u2"), card("c2")], "r1", { text: "  " })).toBe(
      true,
    );
  });

  it("should not hold the first turn of a conversation that had no items while only your message is stored", () => {
    expect(isSentTurnStored([user("u1")], null, withWords)).toBe(false);
    expect(isSentTurnStored([user("u1"), reply("r1")], null, withWords)).toBe(true);
  });

  it("should hold nothing of the turn when the item it was sent after is gone", () => {
    expect(isSentTurnStored([], "r1", withWords)).toBe(true);
  });
});
