import { describe, expect, it } from "vitest";

import {
  applyAssistantEvent,
  failedTurn,
  newLiveTurn,
  stoppedTurn,
} from "../src/assistantLiveTurn";
import { aCard, CONVERSATION_ID, TURN_ID } from "./support/assistantStream";

import type { AssistantStreamEvent } from "@keylow/core";

const applyAll = (events: AssistantStreamEvent[]) =>
  events.reduce(applyAssistantEvent, newLiveTurn());

describe("applyAssistantEvent", () => {
  it("should start a turn with nothing shown", () => {
    expect(newLiveTurn()).toEqual({
      turnId: null,
      conversationId: null,
      text: "",
      cards: [],
      clarify: null,
      confirm: null,
      answerMeta: null,
      status: null,
      notice: null,
      stopped: false,
      outcome: null,
    });
  });

  it("should take the turn and conversation ids from the turn event", () => {
    const live = applyAll([{ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }]);

    expect(live).toMatchObject({ turnId: TURN_ID, conversationId: CONVERSATION_ID });
  });

  it("should append each text delta to the reply so far", () => {
    const live = applyAll([
      { type: "text", delta: "You ate " },
      { type: "text", delta: "1,840 kcal." },
    ]);

    expect(live.text).toBe("You ate 1,840 kcal.");
  });

  it("should keep the cards in the order they arrived", () => {
    const first = aCard("Logged 2 eggs");
    const second = aCard("Logged toast");

    const live = applyAll([
      { type: "card", card: first },
      { type: "card", card: second },
    ]);

    expect(live.cards).toEqual([first, second]);
  });

  it("should hold the clarify question, the confirm and the answer meta without their type", () => {
    const live = applyAll([
      { type: "clarify", question: "How much rice?", quickReplies: ["150 g"], fieldHint: null },
      {
        type: "confirm",
        confirmationId: TURN_ID,
        question: "Delete 3 entries?",
        confirmLabel: "Delete 3 entries",
        cancelLabel: "Keep them",
        tone: "danger",
      },
      { type: "answer_meta", citation: "Based on 38 entries", estimate: null },
    ]);

    expect(live.clarify).toEqual({
      question: "How much rice?",
      quickReplies: ["150 g"],
      fieldHint: null,
    });
    expect(live.confirm).toEqual({
      confirmationId: TURN_ID,
      question: "Delete 3 entries?",
      confirmLabel: "Delete 3 entries",
      cancelLabel: "Keep them",
      tone: "danger",
    });
    expect(live.answerMeta).toEqual({ citation: "Based on 38 entries", estimate: null });
  });

  it("should show the recipe status until anything else arrives", () => {
    const reading = applyAll([{ type: "status", code: "reading_recipe", host: "example.com" }]);
    const afterwards = applyAssistantEvent(reading, { type: "card", card: aCard("Recipe saved") });

    expect(reading.status).toEqual({ code: "reading_recipe", host: "example.com" });
    expect(afterwards.status).toBeNull();
  });

  it("should hold the notice and the outcome", () => {
    const live = applyAll([
      { type: "notice", notice: { code: "plus" } },
      { type: "done", outcome: "failed" },
    ]);

    expect(live).toMatchObject({ notice: { code: "plus" }, outcome: "failed" });
  });
});

describe("stoppedTurn and failedTurn", () => {
  it("should keep a notice that already arrived instead of replacing it", () => {
    const live = failedTurn(
      applyAll([{ type: "notice", notice: { code: "resting", resumesOn: "2026-12-01" } }]),
    );

    expect(live).toMatchObject({
      notice: { code: "resting", resumesOn: "2026-12-01" },
      outcome: "failed",
    });
  });

  it("should keep the text that arrived and mark the turn stopped", () => {
    const live = stoppedTurn(applyAll([{ type: "text", delta: "Yesterday you" }]));

    expect(live).toMatchObject({ text: "Yesterday you", stopped: true, outcome: null });
  });

  it("should keep the text that arrived and add the failed turn notice", () => {
    const live = failedTurn(applyAll([{ type: "text", delta: "Yesterday you" }]));

    expect(live).toMatchObject({
      text: "Yesterday you",
      notice: { code: "turn_failed" },
      outcome: "failed",
      status: null,
      stopped: false,
    });
  });
});
