import { describe, expect, it } from "vitest";

import {
  applyAssistantEvent,
  failedTurn,
  newLiveTurn,
  stoppedTurn,
} from "../src/assistantLiveTurn";
import { aCard, CONVERSATION_ID, TURN_ID } from "./support/assistantStream";

import type { AssistantExerciseMuscles, AssistantStreamEvent } from "@keylow/core";

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
      link: null,
      exerciseMuscles: [],
      askAgain: false,
      notice: null,
      stopped: false,
      outcome: null,
    });
  });

  it("should keep a link that arrives on its own", () => {
    const link = {
      label: "Open in routine editor",
      target: { screen: "routine_editor", routineId: "00000000-0000-4000-8000-0000000000e2" },
    } as const;

    expect(applyAll([{ type: "link", link }]).link).toEqual(link);
  });

  it("should keep the muscles of each exercise in the order they arrived", () => {
    const romanianDeadlift: AssistantExerciseMuscles = {
      exerciseName: "Romanian Deadlift",
      muscles: [{ muscle_id: "hamstrings", role: "primary" }],
    };
    const seatedLegCurl: AssistantExerciseMuscles = {
      exerciseName: "Seated Leg Curl",
      muscles: [{ muscle_id: "hamstrings", role: "primary" }],
    };

    const live = applyAll([
      { type: "exercise_muscles", exercise: romanianDeadlift },
      { type: "text", delta: "Both count." },
      { type: "exercise_muscles", exercise: seatedLegCurl },
    ]);

    expect(live.exerciseMuscles).toEqual([romanianDeadlift, seatedLegCurl]);
    expect(live.text).toBe("Both count.");
  });

  it("should keep the object of each exercise's muscles as later events arrive", () => {
    const exercise: AssistantExerciseMuscles = {
      exerciseName: "Seated Leg Curl",
      muscles: [{ muscle_id: "hamstrings", role: "primary" }],
    };

    const live = applyAll([
      { type: "exercise_muscles", exercise },
      { type: "text", delta: "Both count." },
      { type: "done", outcome: "complete" },
    ]);

    // The cards are memoised on this object, so a streamed token must not replace it.
    expect(live.exerciseMuscles[0]).toBe(exercise);
  });

  it("should clear the step when the muscles of an exercise arrive", () => {
    const thinking = { type: "status", code: "thinking" } as const;
    const exercise: AssistantExerciseMuscles = {
      exerciseName: "Seated Leg Curl",
      muscles: [{ muscle_id: "hamstrings", role: "primary" }],
    };

    expect(applyAll([thinking, { type: "exercise_muscles", exercise }]).status).toBeNull();
  });

  it("should offer Ask again when the event arrives", () => {
    expect(applyAll([{ type: "ask_again" }]).askAgain).toBe(true);
  });

  it("should clear the step when a link or Ask again arrives", () => {
    const thinking = { type: "status", code: "thinking" } as const;

    expect(applyAll([thinking, { type: "ask_again" }]).status).toBeNull();
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

  it("should hold the thinking status without its type", () => {
    expect(applyAll([{ type: "status", code: "thinking" }]).status).toEqual({ code: "thinking" });
  });

  it("should hold a tool status with every field it sent, without its type", () => {
    const live = applyAll([
      { type: "status", code: "tool", tool: "search_foods", food: "toast", isConfirmed: false },
    ]);

    expect(live.status).toEqual({
      code: "tool",
      tool: "search_foods",
      food: "toast",
      isConfirmed: false,
    });
  });

  describe.each<[string, AssistantStreamEvent]>([
    ["reading the recipe", { type: "status", code: "reading_recipe", host: "example.com" }],
    ["thinking", { type: "status", code: "thinking" }],
    [
      "a tool",
      { type: "status", code: "tool", tool: "delete_entry", food: null, isConfirmed: true },
    ],
  ])("the %s status", (_name, status) => {
    it.each<[string, AssistantStreamEvent]>([
      ["a text piece", { type: "text", delta: "Yesterday" }],
      ["a card", { type: "card", card: aCard("Logged toast") }],
      ["a question", { type: "clarify", question: "How much?", quickReplies: [], fieldHint: null }],
      [
        "a confirmation",
        {
          type: "confirm",
          confirmationId: TURN_ID,
          question: "Delete it?",
          confirmLabel: "Delete",
          cancelLabel: "Keep",
          tone: "danger",
        },
      ],
      ["the answer meta", { type: "answer_meta", citation: null, estimate: null }],
      ["a notice", { type: "notice", notice: { code: "plus" } }],
      ["the end of the turn", { type: "done", outcome: "complete" }],
    ])("should clear on %s", (_eventName, next) => {
      expect(applyAssistantEvent(applyAll([status]), next).status).toBeNull();
    });

    it("should clear when the turn is stopped or fails", () => {
      const live = applyAll([status]);

      expect(stoppedTurn(live).status).toBeNull();
      expect(failedTurn(live).status).toBeNull();
    });
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
