import {
  buildAssistantSheetThread,
  describeTurnEndedAfterWrite,
  threadFromMessages,
} from "@keylow/core";
import { describe, expect, it } from "vitest";

import {
  applyAssistantEvent,
  failedTurn,
  newLiveTurn,
  stoppedTurn,
} from "../src/assistantLiveTurn";
import { aCard, CONVERSATION_ID, TURN_ID } from "./support/assistantStream";

import type {
  AssistantExerciseFormMedia,
  AssistantExerciseMuscles,
  AssistantStreamEvent,
} from "@keylow/core";

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
      exerciseFormMedia: [],
      recipeDrafts: [],
      recipeRefusals: [],
      recipeNotices: [],
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

  describe("the form media of an exercise", () => {
    const squat: AssistantExerciseFormMedia = {
      exerciseName: "Barbell Squat",
      media: {
        kind: "video",
        videoId: "abcdefghijk",
        title: "Squat form",
        channel: "Strength Basics",
      },
    };
    const curl: AssistantExerciseFormMedia = {
      exerciseName: "Dumbbell Curl",
      media: { kind: "photos", imagePaths: ["Dumbbell_Curl/0.jpg", "Dumbbell_Curl/1.jpg"] },
    };

    it("should keep each exercise's media in the order it arrived, with the same objects", () => {
      const live = applyAll([
        { type: "exercise_form_media", exercise: squat },
        { type: "text", delta: "Both." },
        { type: "exercise_form_media", exercise: curl },
        { type: "done", outcome: "complete" },
      ]);

      expect(live.exerciseFormMedia).toEqual([squat, curl]);
      // The cards are memoised on these objects, so a streamed token must not replace them.
      expect(live.exerciseFormMedia[0]).toBe(squat);
      expect(live.text).toBe("Both.");
    });

    it("should clear the step when it arrives", () => {
      const thinking = { type: "status", code: "thinking" } as const;

      expect(
        applyAll([thinking, { type: "exercise_form_media", exercise: squat }]).status,
      ).toBeNull();
    });
  });

  describe("a recipe draft", () => {
    const draft: AssistantStreamEvent = {
      type: "recipe_draft",
      draft: {
        variant: "suggestion",
        name: "Chicken and rice bowl",
        servings: 2,
        ingredients: [],
        dropped: [],
        perServing: { kcal: 520, protein_g: 38, fat_g: 14, carbs_g: 55 },
        fit: null,
        steps: [],
      },
    };

    it("should hold each draft in call order and end the step", () => {
      const thinking = { type: "status", code: "thinking" } as const;
      const text = { type: "text", delta: "Here you go." } as const;
      const second: AssistantStreamEvent = {
        type: "recipe_draft",
        draft: { ...draft.draft, name: "Second" },
      };

      expect(applyAll([text, thinking, draft, second])).toEqual({
        ...applyAll([text]),
        status: null,
        recipeDrafts: [draft.draft, second.draft],
      });
    });
  });

  describe("a recipe that did not come", () => {
    const thinking = { type: "status", code: "thinking" } as const;
    const notice: AssistantStreamEvent = {
      type: "recipe_notice",
      notice: { code: "timed_out" },
    };
    const refusal: AssistantStreamEvent = {
      type: "recipe_refusal",
      refusal: {
        recipeName: "Eval porridge bowl",
        nutrient: "protein_g",
        target: 53,
        reached: 17,
        reachedKcal: 389,
      },
    };

    it("should keep each notice, in call order, and clear the step", () => {
      expect(applyAll([thinking, notice, notice]).recipeNotices).toEqual([
        notice.notice,
        notice.notice,
      ]);
      expect(applyAll([thinking, notice]).status).toBeNull();
    });

    it("should keep each refusal, in call order, and clear the step", () => {
      expect(applyAll([thinking, refusal]).recipeRefusals).toEqual([refusal.refusal]);
      expect(applyAll([thinking, refusal]).status).toBeNull();
    });

    it("should not make either a gate notice, which would stop the assistant taking a turn", () => {
      expect(applyAll([notice, refusal]).notice).toBeNull();
    });
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

  describe("after a card was drawn", () => {
    const firstActionId = "00000000-0000-4000-8000-0000000000d1";
    const secondActionId = "00000000-0000-4000-8000-0000000000d2";

    it("should show the saved words and no notice, whatever broke the stream", () => {
      const live = failedTurn(
        applyAll([
          { type: "card", card: aCard("Logged 2 eggs") },
          { type: "text", delta: "Done, and" },
        ]),
      );

      expect(live.notice).toBeNull();
      expect(live.text).toBe(`Done, and\n\n${describeTurnEndedAfterWrite(1)}`);
      expect(live.outcome).toBe("failed");
      expect(live.cards).toHaveLength(1);
    });

    it("should put the words alone in a reply that had no text yet", () => {
      const live = failedTurn(applyAll([{ type: "card", card: aCard("Logged 2 eggs") }]));

      expect(live.text).toBe(describeTurnEndedAfterWrite(1));
    });

    it("should use the plural when the cards hold more than one change", () => {
      const merged = {
        ...aCard("Logged 2 foods"),
        actionIds: [firstActionId, secondActionId],
      };

      const live = failedTurn(applyAll([{ type: "card", card: merged }]));

      expect(live.text).toBe(describeTurnEndedAfterWrite(2));
    });

    it("should count one change for each card of a different kind", () => {
      const live = failedTurn(
        applyAll([
          { type: "card", card: aCard("Logged an egg") },
          {
            type: "card",
            card: { ...aCard("Updated"), kind: "updated", actionIds: [secondActionId] },
          },
        ]),
      );

      expect(live.text).toBe(describeTurnEndedAfterWrite(2));
    });

    it("should keep a notice that already arrived, with the cards as they are", () => {
      const live = failedTurn(
        applyAll([
          { type: "card", card: aCard("Logged 2 eggs") },
          { type: "notice", notice: { code: "switched_off" } },
        ]),
      );

      expect(live.notice).toEqual({ code: "switched_off" });
    });

    it("should agree with a reopened failed turn that holds the same card: no notice in either", () => {
      const card = aCard("Logged 2 eggs");
      const live = failedTurn(applyAll([{ type: "card", card }]));
      const reopened = threadFromMessages(
        [
          {
            id: "m1",
            turnId: TURN_ID,
            role: "user",
            content: [{ type: "text", text: "Log 2 eggs" }],
            display: null,
            turnStatus: "failed",
          },
          {
            id: "m2",
            turnId: TURN_ID,
            role: "assistant",
            content: [{ type: "tool_use", id: "c1", name: "log_entry", input: {} }],
            display: null,
            turnStatus: "failed",
          },
          {
            id: "m3",
            turnId: TURN_ID,
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "c1" }],
            display: { c1: { card } },
            turnStatus: "failed",
          },
        ],
        [],
      );

      expect(live.notice).toBeNull();
      expect(reopened.map((item) => item.kind)).toEqual(["user", "card"]);
    });

    it("should not add the words again when the server's own words arrived before the stream broke", () => {
      for (const writes of [1, 2]) {
        const live = failedTurn(
          applyAll([
            { type: "card", card: aCard("Logged 2 eggs") },
            { type: "text", delta: `Done.\n\n${describeTurnEndedAfterWrite(writes)}` },
          ]),
        );

        expect(live.text).toBe(`Done.\n\n${describeTurnEndedAfterWrite(writes)}`);
      }
    });
  });

  describe("a stopped turn after a card was drawn", () => {
    const stoppedAfterCard = () =>
      stoppedTurn(
        applyAll([
          { type: "card", card: aCard("Logged 2 eggs") },
          { type: "text", delta: "Done, and" },
        ]),
      );

    it("should end in the saved words, not stopped, with no notice and no outcome", () => {
      const live = stoppedAfterCard();

      expect(live).toMatchObject({
        text: `Done, and\n\n${describeTurnEndedAfterWrite(1)}`,
        stopped: false,
        notice: null,
        outcome: null,
        status: null,
      });
      expect(live.cards).toHaveLength(1);
    });

    it("should offer no Ask again, because sending the message again would repeat the write", () => {
      const thread = buildAssistantSheetThread({
        items: [],
        sent: { text: "Log 2 eggs", afterItemId: null },
        live: stoppedAfterCard(),
        isStreaming: false,
      });

      expect(thread.canAskAgain).toBe(false);
    });

    it("should keep a stopped turn with no card as it was, stopped and open to Ask again", () => {
      const live = stoppedTurn(applyAll([{ type: "text", delta: "Yesterday you" }]));

      expect(live).toMatchObject({ text: "Yesterday you", stopped: true, outcome: null });
      expect(
        buildAssistantSheetThread({
          items: [],
          sent: { text: "How was Monday?", afterItemId: null },
          live,
          isStreaming: false,
        }).canAskAgain,
      ).toBe(true);
    });

    it("should not add the words twice", () => {
      const once = stoppedAfterCard();

      expect(stoppedTurn(once).text).toBe(once.text);
    });
  });
});
