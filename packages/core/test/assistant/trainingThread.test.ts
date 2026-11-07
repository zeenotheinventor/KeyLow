import { describe, expect, it } from "vitest";

import {
  firstTurnId,
  replyMessage,
  secondTurnId,
  toolResultMessage,
  toolUseMessage,
  userMessage,
} from "./storedConversations";
import { routineCreatedCard, routineId, routineUpdatedCard } from "./trainingCardFixtures";
import {
  buildAssistantSheetThread,
  isSentTurnStored,
  isStaleStreamGateNotice,
  resolveAssistantSheetAccess,
  threadFromMessages,
} from "../../src/assistant";

import type {
  AssistantCardLink,
  AssistantSheetLiveTurn,
  AssistantThreadItem,
} from "../../src/assistant";

const link: AssistantCardLink = {
  label: "Open in routine editor",
  target: { screen: "routine_editor", routineId },
};

const removedDayWords = "A day can only be removed in the routine editor.";

const storedTurn = (
  outcome: unknown,
  words?: string,
  turnId: string = firstTurnId,
  ids = ["m1", "m2", "m3", "m4"],
) => [
  userMessage(ids[0] ?? "m1", turnId, "Remove the Legs day from my routine"),
  toolUseMessage(ids[1] ?? "m2", turnId, [{ id: `${turnId}:call`, name: "edit_routine" }]),
  toolResultMessage(ids[2] ?? "m3", turnId, [
    { toolUseId: `${turnId}:call`, source: "edit_routine", outcome },
  ]),
  ...(words === undefined ? [] : [replyMessage(ids[3] ?? "m4", turnId, words)]),
];

describe("threadFromMessages, a link and Ask again", () => {
  it("should draw a link under the reply, as assistant-card · routine-updated, Removing a day, does", () => {
    const thread = threadFromMessages(storedTurn({ link }, removedDayWords), []);

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "link"]);
    expect(thread[2]).toEqual({ kind: "link", id: "m3:0", link });
  });

  it("should draw a link when the turn has no words", () => {
    expect(threadFromMessages(storedTurn({ link }), []).map((item) => item.kind)).toEqual([
      "user",
      "link",
    ]);
  });

  it("should read a link beside a card without drawing it twice", () => {
    const thread = threadFromMessages(storedTurn({ card: routineUpdatedCard, link }), []);

    expect(thread.map((item) => item.kind)).toEqual(["user", "card", "link"]);
  });

  it("should draw Ask again at the end of the turn, as assistant · workout-in-progress does", () => {
    const thread = threadFromMessages(
      storedTurn({ askAgain: true }, "Your workout is in progress."),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply", "ask_again"]);
    expect(thread[2]).toEqual({ kind: "ask_again", id: "m3:0", answered: false });
  });

  it("should mark Ask again answered once a later turn exists, so the chip goes", () => {
    const thread = threadFromMessages(
      [
        ...storedTurn({ askAgain: true }, "Your workout is in progress."),
        ...storedTurn({}, "Done.", secondTurnId, ["m5", "m6", "m7", "m8"]),
      ],
      [],
    );

    expect(thread.find((item) => item.kind === "ask_again")).toMatchObject({ answered: true });
  });

  it("should draw neither when the display says there is none", () => {
    const thread = threadFromMessages(storedTurn({ askAgain: false }, "Fine."), []);

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply"]);
  });

  it("should drop a link the contract does not know, and only that entry", () => {
    const thread = threadFromMessages(
      storedTurn({ link: { label: "Open", target: { screen: "nowhere" } } }, "Fine."),
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

const askedItems: AssistantThreadItem[] = [
  { kind: "user", id: "u1", text: "Swap leg press for hack squat" },
  {
    kind: "reply",
    id: "r1",
    text: "Your workout is in progress.",
    answerMeta: null,
    stopped: false,
  },
  { kind: "ask_again", id: "a1", answered: false },
];

describe("buildAssistantSheetThread, a link and Ask again", () => {
  it("should draw a stored link as an entry of its own", () => {
    const entries = build({ items: [{ kind: "link", id: "l1", link }] }).entries;

    expect(entries).toEqual([{ kind: "link", key: "l1", link }]);
  });

  it("should offer Ask again under a reply that asked for it, and send your last message", () => {
    const thread = build({ items: askedItems });

    expect(thread.canAskAgain).toBe(true);
    expect(thread.lastMessage).toBe("Swap leg press for hack squat");
  });

  it("should not offer Ask again once it is answered", () => {
    const items = askedItems.map((item) =>
      item.kind === "ask_again" ? { ...item, answered: true } : item,
    );

    expect(build({ items }).canAskAgain).toBe(false);
  });

  it("should take Ask again away when a later message is sent", () => {
    const thread = build({
      items: askedItems,
      sent: { text: "Swap leg press for hack squat", afterItemId: "a1" },
      live: liveTurn(),
      isStreaming: true,
    });

    expect(thread.canAskAgain).toBe(false);
  });

  it("should offer Ask again from the turn on screen once it has ended", () => {
    const sent = { text: "Swap leg press for hack squat", afterItemId: null };
    const live = liveTurn({
      text: "Your workout is in progress.",
      askAgain: true,
      outcome: "complete",
    });

    expect(build({ sent, live, isStreaming: false }).canAskAgain).toBe(true);
    expect(build({ sent, live, isStreaming: true }).canAskAgain).toBe(false);
  });

  it("should draw the link of the turn on screen after its words", () => {
    const sent = { text: "Remove the Legs day from my routine", afterItemId: null };
    const live = liveTurn({ text: removedDayWords, link, outcome: "complete" });

    expect(build({ sent, live }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "assistant",
      "link",
    ]);
  });

  it("should keep Ask again for a stopped answer as it was", () => {
    const sent = { text: "Hello", afterItemId: null };
    const live = liveTurn({ text: "Partly", stopped: true });

    expect(build({ sent, live }).canAskAgain).toBe(true);
  });
});

describe("isSentTurnStored, a link and Ask again", () => {
  it("should count Ask again as the end of the turn", () => {
    expect(isSentTurnStored(askedItems.slice(0, 1).concat(askedItems[2] ?? []), "u1", null)).toBe(
      true,
    );
  });

  it("should count a link as the end of a turn with no words, as a card is", () => {
    const items: AssistantThreadItem[] = [
      { kind: "user", id: "u1", text: "Hello" },
      { kind: "link", id: "l1", link },
    ];

    expect(isSentTurnStored(items, "u1", null)).toBe(true);
    expect(isSentTurnStored(items, "u1", { text: "Words to come" })).toBe(false);
  });
});

describe("buildAssistantSheetThread, the full height of a routine", () => {
  const cardItem = (id: string, card: typeof routineCreatedCard): AssistantThreadItem => ({
    kind: "card",
    id,
    card,
  });

  it("should ask for full height when the last card is a routine that was built", () => {
    expect(build({ items: [cardItem("c1", routineCreatedCard)] }).needsFullHeight).toBe(true);
  });

  it("should not when the last card is another kind", () => {
    const items = [cardItem("c1", routineCreatedCard), cardItem("c2", routineUpdatedCard)];

    expect(build({ items }).needsFullHeight).toBe(false);
  });

  it("should for a card built in the turn on screen", () => {
    const sent = { text: "Build me a routine", afterItemId: null };

    expect(build({ sent, live: liveTurn({ cards: [routineCreatedCard] }) }).needsFullHeight).toBe(
      true,
    );
  });
});

describe("the workout_in_progress notice in the sheet", () => {
  const notice = { code: "workout_in_progress" } as const;

  it("should leave the assistant open, because questions still work", () => {
    expect(
      resolveAssistantSheetAccess({
        statusNotice: null,
        isStatusKnown: true,
        streamNotice: notice,
      }),
    ).toEqual({ kind: "open" });
  });

  it("should not count as a gate that goes stale when the status is read again", () => {
    expect(isStaleStreamGateNotice({ streamNotice: notice, isStreaming: false })).toBe(false);
  });

  it("should be drawn in the thread under your message, with its Ask again after it", () => {
    const sent = { text: "Yes, remove it", afterItemId: null };
    const live = liveTurn({ notice, askAgain: true, outcome: "failed" });

    expect(build({ sent, live }).entries.map((entry) => entry.kind)).toEqual([
      "you",
      "notice",
      "askAgain",
    ]);
  });
});
