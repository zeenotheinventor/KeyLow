import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  boardConversation,
  firstTurnId,
  message,
  replyMessage,
  secondTurnId,
  toolResultMessage,
  toolUseMessage,
  userMessage,
  wrapToolResult,
} from "./storedConversations";
import { threadFromMessages } from "../../src/assistant";

import type { AssistantActionState } from "../../src/assistant";

const firstActionId = "00000000-0000-4000-8000-0000000000d1";
const secondActionId = "00000000-0000-4000-8000-0000000000d2";

const availableActions: AssistantActionState[] = loggedCard.actionIds.map((id) => ({
  id,
  hasTarget: true,
  undoneAt: null,
  targetUpdatedAt: null,
  targets: null,
}));

const kinds = (items: { kind: string }[]) => items.map((item) => item.kind);

describe("threadFromMessages, the assistant · conversation board", () => {
  const thread = threadFromMessages(boardConversation, availableActions);

  it("should give the user, the card, the user and the reply", () => {
    expect(kinds(thread)).toEqual(["user", "card", "user", "reply"]);
  });

  it("should drop the date preamble the turn loop adds before the person's words", () => {
    expect(thread[0]).toMatchObject({ kind: "user", text: "2 eggs and toast at 8:10" });
  });

  it("should carry the card of the write tool result with its live undo state", () => {
    expect(thread[1]).toMatchObject({ kind: "card", card: { ...loggedCard, undo: "available" } });
  });

  it("should put the citation of a read result under the reply, with no estimate", () => {
    expect(thread[3]).toEqual({
      kind: "reply",
      id: "m7:text",
      text: "You have 1,693 kcal and 117 g of protein left today.",
      answerMeta: { citation: "Based on 4 entries today and your targets", estimate: null },
      stopped: false,
    });
  });

  it("should give every item its own id", () => {
    expect(new Set(thread.map((item) => item.id)).size).toBe(thread.length);
  });
});

describe("threadFromMessages, the person's words", () => {
  it("should keep the words of a message that has no preamble", () => {
    const thread = threadFromMessages([userMessage("m1", firstTurnId, "Hello", false)], []);

    expect(thread).toMatchObject([{ kind: "user", text: "Hello" }]);
  });

  it("should read a message whose content is a plain string", () => {
    const thread = threadFromMessages(
      [message({ id: "m1", turnId: firstTurnId, role: "user", content: "Hello" })],
      [],
    );

    expect(thread).toMatchObject([{ kind: "user", text: "Hello" }]);
  });

  it("should give nothing for a message of a kind it does not know", () => {
    const thread = threadFromMessages(
      [
        message({
          id: "m1",
          turnId: firstTurnId,
          role: "assistant",
          content: [{ type: "thinking" }],
        }),
      ],
      [],
    );

    expect(thread).toEqual([]);
  });
});

describe("threadFromMessages, the stop of a reply", () => {
  const stopped = [
    message({
      ...userMessage("m1", firstTurnId, "How much protein did I average last week?"),
      turnStatus: "stopped",
    }),
    message({
      id: "m2",
      turnId: firstTurnId,
      role: "assistant",
      content: [{ type: "text", text: "You averaged 126 g of protein a day from Monday 12 to" }],
      turnStatus: "stopped",
    }),
  ];

  it("should keep stopped on the reply the closing of the sheet cut short", () => {
    const thread = threadFromMessages(stopped, []);

    expect(thread[1]).toMatchObject({ kind: "reply", stopped: true });
  });

  it("should not mark a reply of a finished turn as stopped", () => {
    const thread = threadFromMessages(boardConversation, availableActions);

    expect(thread.every((item) => item.kind !== "reply" || !item.stopped)).toBe(true);
  });
});

describe("threadFromMessages, a failed turn", () => {
  it.each(["failed", "refused"] as const)(
    "should end a %s turn with the failed-turn notice",
    (turnStatus) => {
      const thread = threadFromMessages(
        [message({ ...userMessage("m1", firstTurnId, "Log a flat white at 07:30"), turnStatus })],
        [],
      );

      expect(thread[1]).toMatchObject({ kind: "notice", notice: { code: "turn_failed" } });
    },
  );
});

describe("threadFromMessages, the undo state of a card", () => {
  const cardThread = (actions: AssistantActionState[]) =>
    threadFromMessages(boardConversation, actions).flatMap((item) =>
      item.kind === "card" ? [item.card.undo] : [],
    );

  it("should be undone once every action of the card has undone_at set", () => {
    const actions = availableActions.map((action) => ({
      ...action,
      undoneAt: "2026-10-26T08:20:00Z",
    }));

    expect(cardThread(actions)).toEqual(["undone"]);
  });

  it("should stay available while only some of the actions are undone", () => {
    const actions = availableActions.map((action, index) =>
      index === 0 ? { ...action, undoneAt: "2026-10-26T08:20:00Z" } : action,
    );

    expect(cardThread(actions)).toEqual(["available"]);
  });

  it("should be unavailable when a target changed since the write left it", () => {
    const actions = availableActions.map((action, index) => ({
      ...action,
      targetUpdatedAt: "2026-10-26T08:10:00Z",
      targets: [
        { found: true, updatedAt: index === 0 ? "2026-10-26T09:00:00Z" : "2026-10-26T08:10:00Z" },
      ],
    }));

    expect(cardThread(actions)).toEqual(["unavailable"]);
  });

  it("should be unavailable when a target no longer exists", () => {
    const actions = availableActions.map((action) => ({
      ...action,
      targetUpdatedAt: "2026-10-26T08:10:00Z",
      targets: [{ found: false, updatedAt: null }],
    }));

    expect(cardThread(actions)).toEqual(["unavailable"]);
  });

  it("should stay available while the targets are as the write left them", () => {
    const actions = availableActions.map((action) => ({
      ...action,
      targetUpdatedAt: "2026-10-26T08:10:00Z",
      targets: [{ found: true, updatedAt: "2026-10-26T08:10:00Z" }],
    }));

    expect(cardThread(actions)).toEqual(["available"]);
  });

  it("should be unavailable when the card names an action that is not there", () => {
    expect(cardThread([])).toEqual(["unavailable"]);
  });

  it("should stay unavailable on a card that can never be undone, whatever the actions say", () => {
    const edit = {
      ...loggedCard,
      kind: "updated" as const,
      undo: "unavailable" as const,
      undoneSub: null,
    };
    const thread = threadFromMessages(
      [
        userMessage("m1", firstTurnId, "Make that 3 eggs"),
        toolUseMessage("m2", firstTurnId, [{ id: "call-1", name: "update_entry" }]),
        toolResultMessage("m3", firstTurnId, [
          { toolUseId: "call-1", source: "update_entry", outcome: { card: edit } },
        ]),
      ],
      availableActions,
    );

    expect(thread[1]).toMatchObject({ kind: "card", card: { undo: "unavailable" } });
  });
});

describe("threadFromMessages, merging the cards of one turn", () => {
  const first = {
    ...loggedCard,
    actionIds: [firstActionId],
    title: "Logged 2 eggs at 08:10",
    rows: loggedCard.rows.slice(0, 1),
  };
  const second = {
    ...loggedCard,
    actionIds: [secondActionId],
    title: "Logged toast at 08:10",
    rows: loggedCard.rows.slice(1),
  };
  const mergedTurn = (resultsBetween: "none" | "reply") => [
    userMessage("m1", firstTurnId, "2 eggs, and a coffee"),
    toolUseMessage("m2", firstTurnId, [
      { id: "call-1", name: "log_entry" },
      { id: "call-2", name: "log_entry" },
    ]),
    toolResultMessage("m3", firstTurnId, [
      {
        toolUseId: "call-1",
        source: "log_entry",
        outcome: { card: first },
      },
      { toolUseId: "call-2", source: "log_entry", outcome: { card: second } },
    ]),
    ...(resultsBetween === "reply" ? [replyMessage("m4", firstTurnId, "Done.")] : []),
  ];

  it("should merge consecutive results of one tool into one card with the action ids joined", () => {
    const thread = threadFromMessages(mergedTurn("none"), availableActions);

    expect(thread).toMatchObject([
      { kind: "user" },
      {
        kind: "card",
        card: {
          actionIds: [firstActionId, secondActionId],
          title: "Logged 2 eggs and toast at 08:10",
        },
      },
    ]);
  });

  it("should keep the cards of two turns apart", () => {
    const thread = threadFromMessages(
      [
        ...mergedTurn("none").slice(0, 3),
        userMessage("m4", secondTurnId, "And another coffee"),
        toolUseMessage("m5", secondTurnId, [{ id: "call-3", name: "log_entry" }]),
        toolResultMessage("m6", secondTurnId, [
          { toolUseId: "call-3", source: "log_entry", outcome: { card: second } },
        ]),
      ],
      availableActions,
    );

    expect(kinds(thread)).toEqual(["user", "card", "user", "card"]);
  });
});

describe("threadFromMessages, a question and a confirmation", () => {
  const askUser = [
    userMessage("m1", firstTurnId, "Some chicken and rice for lunch"),
    toolUseMessage("m2", firstTurnId, [
      {
        id: "call-1",
        name: "ask_user",
        input: {
          question: "How much chicken and how much rice?",
          quick_replies: ["1 chicken breast, 150 g rice"],
        },
      },
    ]),
  ];
  const confirmation = {
    confirmationId: "00000000-0000-4000-8000-0000000000c1",
    question: "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and an apple.",
    confirmLabel: "Delete 3 entries",
    cancelLabel: "Keep them",
    tone: "danger",
  };
  const confirmTurn = [
    userMessage("m1", firstTurnId, "Delete everything from lunch today"),
    toolUseMessage("m2", firstTurnId, [{ id: "call-1", name: "delete_entry" }]),
    toolResultMessage("m3", firstTurnId, [
      { toolUseId: "call-1", source: "delete_entry", outcome: { confirm: confirmation } },
    ]),
  ];

  it("should turn an ask_user call into a clarify item with the board's field hint", () => {
    expect(threadFromMessages(askUser, [])[1]).toMatchObject({
      kind: "clarify",
      question: "How much chicken and how much rice?",
      quickReplies: ["1 chicken breast, 150 g rice"],
      fieldHint: "Or say it your way",
      answered: false,
    });
  });

  it("should mark a clarify item answered once a later turn exists", () => {
    const thread = threadFromMessages(
      [...askUser, userMessage("m3", secondTurnId, "1 chicken breast, 150 g rice")],
      [],
    );

    expect(thread[1]).toMatchObject({ kind: "clarify", answered: true });
  });

  it("should turn a needs_confirmation result into a confirm item", () => {
    expect(threadFromMessages(confirmTurn, [])[1]).toEqual({
      kind: "confirm",
      id: "m3:0",
      ...confirmation,
      answered: false,
    });
  });

  it("should mark a confirm item answered once a later turn exists", () => {
    const thread = threadFromMessages(
      [...confirmTurn, userMessage("m4", secondTurnId, "Delete 3 entries")],
      [],
    );

    expect(thread[1]).toMatchObject({ kind: "confirm", answered: true });
  });
});

describe("threadFromMessages, the meta of an answer", () => {
  const answerTurn = (outcomes: Record<string, unknown>[]) => [
    userMessage("m1", firstTurnId, "How fast is my weight going down?"),
    toolUseMessage(
      "m2",
      firstTurnId,
      outcomes.map((_, index) => ({ id: `call-${index}`, name: "get_range_totals" })),
    ),
    toolResultMessage(
      "m3",
      firstTurnId,
      outcomes.map((outcome, index) => ({
        toolUseId: `call-${index}`,
        source: "get_range_totals",
        outcome,
      })),
    ),
    replyMessage("m4", firstTurnId, "Your trend weight fell by 0.4 kg a week."),
  ];

  it("should join the distinct citations in call order and keep the estimate label", () => {
    const thread = threadFromMessages(
      answerTurn([
        {
          citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
          estimate: "Trend weight is an estimate",
        },
        { citation: "Based on 4 entries today and your targets" },
        { citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct" },
      ]),
      [],
    );

    expect(thread[1]).toMatchObject({
      kind: "reply",
      answerMeta: {
        citation:
          "Based on 24 weigh-ins, 21 Sep to 18 Oct · Based on 4 entries today and your targets",
        estimate: "Trend weight is an estimate",
      },
    });
  });

  it("should give no meta when no result carried a citation or an estimate", () => {
    const thread = threadFromMessages(answerTurn([{ kcal: 1193 }]), []);

    expect(thread[1]).toMatchObject({ kind: "reply", answerMeta: null });
  });

  it("should ignore a result that has no display entry, whatever its text says", () => {
    const thread = threadFromMessages(
      [
        userMessage("m1", firstTurnId, "Hi"),
        toolUseMessage("m2", firstTurnId, [{ id: "call-1", name: "get_day" }]),
        message({
          id: "m3",
          turnId: firstTurnId,
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "call-1",
              content: wrapToolResult("get_day", { citation: "Based on text the model saw" }),
            },
          ],
        }),
        replyMessage("m4", firstTurnId, "Hello"),
      ],
      [],
    );

    expect(thread[1]).toMatchObject({ kind: "reply", answerMeta: null });
  });
});

describe("threadFromMessages, the display of a message", () => {
  const goodCard = { ...loggedCard, actionIds: [secondActionId] };
  const badCard = { ...loggedCard, title: "" };

  it("should drop only the entry that does not parse and keep the others of the conversation", () => {
    const thread = threadFromMessages(
      [
        userMessage("m1", firstTurnId, "2 eggs, and a coffee"),
        toolUseMessage("m2", firstTurnId, [
          { id: "call-1", name: "log_entry" },
          { id: "call-2", name: "delete_entry" },
        ]),
        toolResultMessage("m3", firstTurnId, [
          { toolUseId: "call-1", source: "log_entry", outcome: { card: badCard } },
          {
            toolUseId: "call-2",
            source: "delete_entry",
            outcome: { card: { ...goodCard, kind: "deleted" } },
          },
        ]),
      ],
      availableActions,
    );

    expect(kinds(thread)).toEqual(["user", "card"]);
  });

  it("should read a message whose display is null or not an object", () => {
    const thread = threadFromMessages(
      [
        userMessage("m1", firstTurnId, "Hi"),
        message({ id: "m2", turnId: firstTurnId, role: "user", content: [], display: "oops" }),
        replyMessage("m3", firstTurnId, "Hello"),
      ],
      [],
    );

    expect(kinds(thread)).toEqual(["user", "reply"]);
  });

  it.each(["updated", "recipe_updated"] as const)(
    "should keep a %s card unavailable, however the card was stored",
    (kind) => {
      const thread = threadFromMessages(
        [
          userMessage("m1", firstTurnId, "Make that 3 eggs"),
          toolUseMessage("m2", firstTurnId, [{ id: "call-1", name: "update_entry" }]),
          toolResultMessage("m3", firstTurnId, [
            {
              toolUseId: "call-1",
              source: "update_entry",
              outcome: { card: { ...loggedCard, kind, undo: "available" } },
            },
          ]),
        ],
        availableActions,
      );

      expect(thread[1]).toMatchObject({ kind: "card", card: { undo: "unavailable" } });
    },
  );

  it("should show a card whose action never landed as unavailable", () => {
    const reserved = availableActions.map((action) => ({ ...action, hasTarget: false }));

    const thread = threadFromMessages(boardConversation, reserved);

    expect(thread[1]).toMatchObject({ kind: "card", card: { undo: "unavailable" } });
  });
});
