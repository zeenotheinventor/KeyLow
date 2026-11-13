import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  firstTurnId,
  replyMessage,
  toolResultMessage,
  toolUseMessage,
  userMessage,
} from "./storedConversations";
import { threadFromMessages } from "../../src/assistant";

describe("threadFromMessages, a stored card of a kind this app does not know", () => {
  const storedTurn = (outcomes: { toolUseId: string; outcome: unknown }[]) => [
    userMessage("m1", firstTurnId, "Plan my week"),
    toolUseMessage(
      "m2",
      firstTurnId,
      outcomes.map(({ toolUseId }) => ({ id: toolUseId, name: "plan_meals" })),
    ),
    toolResultMessage(
      "m3",
      firstTurnId,
      outcomes.map((result) => ({ ...result, source: "plan_meals" })),
    ),
    replyMessage("m4", firstTurnId, "Done."),
  ];

  it("should still load the conversation, with the reply and without the card", () => {
    const thread = threadFromMessages(
      storedTurn([
        { toolUseId: "call-1", outcome: { card: { ...loggedCard, kind: "future_card" } } },
      ]),
      [],
    );

    expect(thread.map((item) => item.kind)).toEqual(["user", "reply"]);
  });
});
