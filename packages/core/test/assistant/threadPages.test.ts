import { describe, expect, it } from "vitest";

import { firstTurnId, secondTurnId, toolUseMessage, userMessage } from "./storedConversations";
import {
  ASSISTANT_THREAD_PAGE_TURNS,
  joinAssistantThreadPages,
  pageOfAssistantTurns,
  threadFromMessages,
} from "../../src/assistant";

const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000b1";

/** `count` turn rows, newest first, as a read ordered by `created_at desc` returns them. */
const turnRowsNewestFirst = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `turn-${count - index}`,
    createdAt: `2026-11-01T10:${String(count - index).padStart(2, "0")}:00Z`,
  }));

describe("pageOfAssistantTurns", () => {
  it("should read 20 turns to a page", () => {
    expect(ASSISTANT_THREAD_PAGE_TURNS).toBe(20);
  });

  it("should give no turns and no cursor for no rows", () => {
    expect(pageOfAssistantTurns(CONVERSATION_ID, [])).toEqual({ turns: [], olderCursor: null });
  });

  it("should give one turn and no cursor for one row", () => {
    const rows = turnRowsNewestFirst(1);

    expect(pageOfAssistantTurns(CONVERSATION_ID, rows)).toEqual({ turns: rows, olderCursor: null });
  });

  it("should give 20 turns oldest first and no cursor for 20 rows", () => {
    const page = pageOfAssistantTurns(CONVERSATION_ID, turnRowsNewestFirst(20));

    expect(page.turns.map((turn) => turn.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `turn-${index + 1}`),
    );
    expect(page.olderCursor).toBeNull();
  });

  it("should drop the extra row at 21 and name the oldest turn it kept in the cursor", () => {
    const page = pageOfAssistantTurns(CONVERSATION_ID, turnRowsNewestFirst(21));

    expect(page.turns.map((turn) => turn.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `turn-${index + 2}`),
    );
    expect(page.olderCursor).toEqual({
      conversationId: CONVERSATION_ID,
      createdAt: "2026-11-01T10:02:00Z",
      turnId: "turn-2",
    });
  });
});

describe("joinAssistantThreadPages", () => {
  const first = userMessage("m1", firstTurnId, "Hello");
  const second = userMessage("m2", secondTurnId, "Again");
  const action = (id: string) => ({ id });

  it("should put an older page's messages before the newest page's, as its turns are older", () => {
    const joined = joinAssistantThreadPages([
      { messages: [second], actions: [] },
      { messages: [first], actions: [] },
    ]);

    expect(joined.messages.map((row) => row.id)).toEqual(["m1", "m2"]);
  });

  it("should keep one copy of a message or an action that two pages both hold", () => {
    const joined = joinAssistantThreadPages([
      { messages: [second], actions: [action("a1")] },
      { messages: [first, second], actions: [action("a1"), action("a2")] },
    ]);

    expect(joined.messages.map((row) => row.id)).toEqual(["m1", "m2"]);
    expect(joined.actions.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("should give an empty thread for no pages", () => {
    expect(joinAssistantThreadPages([])).toEqual({ messages: [], actions: [] });
  });

  it("should mark a question on the last turn of an older page answered once the pages are joined", () => {
    const question = [
      userMessage("m1", firstTurnId, "Some chicken and rice for lunch"),
      toolUseMessage("m2", firstTurnId, [
        {
          id: "call-1",
          name: "ask_user",
          input: { question: "How much chicken?", quick_replies: [] },
        },
      ]),
    ];
    const newer = [userMessage("m4", secondTurnId, "A bowl")];

    const olderPageAlone = threadFromMessages(question, []);
    const joined = joinAssistantThreadPages([
      { messages: newer, actions: [] },
      { messages: question, actions: [] },
    ]);
    const thread = threadFromMessages(joined.messages, joined.actions);

    expect(olderPageAlone.find((item) => item.kind === "clarify")).toMatchObject({
      answered: false,
    });
    expect(thread.find((item) => item.kind === "clarify")).toMatchObject({ answered: true });
  });
});
