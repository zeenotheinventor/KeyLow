import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ASSISTANT_CARD_WORDS,
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_NOT_MEDICAL_ADVICE,
  ASSISTANT_OFFLINE,
  ASSISTANT_STOPPED,
  describeAssistantNotice,
  describeAssistantStatus,
} from "../../src/copy";

describe("describeAssistantNotice", () => {
  it("should word the day limit as assistant · day-limit prints it", () => {
    expect(
      describeAssistantNotice({ code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" }),
    ).toEqual({
      title: "You have used today's turns",
      body: "The assistant is back at midnight. Logging, search and quick add work as normal.",
      fieldText: "Back at midnight",
      button: null,
    });
  });

  it("should word the missing entitlement as assistant · plus prints it", () => {
    expect(describeAssistantNotice({ code: "plus" })).toEqual({
      title: "The assistant is part of Ki-Lo Plus",
      body: "Your account does not include Ki-Lo Plus at the moment. Logging, search and quick add work as normal.",
      fieldText: "Not on your account",
      button: null,
    });
  });

  it("should word resting until 1 November as assistant · resting prints it", () => {
    expect(describeAssistantNotice({ code: "resting", resumesOn: "2026-11-01" })).toEqual({
      title: "The assistant is resting until 1 November",
      body: "It has reached this month's limit. Your conversations are kept. Everything else in Ki-Lo works as normal.",
      fieldText: "Back on 1 November",
      button: null,
    });
  });

  it("should build the resting day from resumesOn", () => {
    const resting = describeAssistantNotice({ code: "resting", resumesOn: "2027-01-01" });

    expect([resting.title, resting.fieldText]).toEqual([
      "The assistant is resting until 1 January",
      "Back on 1 January",
    ]);
  });

  it("should word the kill switch as assistant · unavailable (left) prints it", () => {
    expect(describeAssistantNotice({ code: "switched_off" })).toEqual({
      title: "The assistant is switched off for now",
      body: "Try again later. Everything else in Ki-Lo works as normal.",
      fieldText: "Switched off for now",
      button: null,
    });
  });

  it("should not take the consent notice, whose words are the consent card's", () => {
    expectTypeOf<{ code: "consent_needed" }>().not.toExtend<
      Parameters<typeof describeAssistantNotice>[0]
    >();
  });

  it("should word a failed turn as assistant · unavailable (middle) prints it, composer left on", () => {
    expect(describeAssistantNotice({ code: "turn_failed" })).toEqual({
      title: "That answer did not come through",
      body: "Nothing was changed. Check your connection and try again.",
      fieldText: null,
      button: "Try again",
    });
  });
});

describe("describeAssistantStatus", () => {
  it("should word reading a recipe as assistant · recipe-import (left) prints it", () => {
    expect(describeAssistantStatus({ code: "reading_recipe", host: "example.com" })).toBe(
      "Reading the recipe at example.com",
    );
  });
});

describe("the assistant words the app shows without a notice code", () => {
  it("should word offline as assistant · unavailable (right) prints it", () => {
    expect(ASSISTANT_OFFLINE).toEqual({
      title: "You're offline",
      body: "The assistant needs a connection. Your diary still works.",
      fieldText: "Needs a connection",
    });
  });

  it("should word a reply stopped by closing the sheet as assistant · streaming (right) prints it", () => {
    expect(ASSISTANT_STOPPED).toEqual({
      label: "Stopped when you closed the assistant",
      askAgain: "Ask again",
    });
  });
});

describe("ASSISTANT_CONSENT_CARD", () => {
  it("should carry the words of assistant · consent-needed", () => {
    expect(ASSISTANT_CONSENT_CARD).toEqual({
      title: "Turn on the assistant",
      paragraphs: [
        "The assistant answers questions about your diary, weight and targets, and logs, copies and changes entries for you. Every change shows as a card with Undo.",
        "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
      ],
      privacyLinkLabel: "Privacy policy",
      smallPrint:
        "The assistant's answers are not medical advice. Speak to a doctor before you make big changes to your diet or your weight. You can turn the assistant off in More, Assistant.",
      turnOnLabel: "Turn on",
      notNowLabel: "Not now",
    });
  });

  it("should open its small print with the not-medical-advice line the empty sheet shows", () => {
    expect(ASSISTANT_CONSENT_CARD.smallPrint.startsWith(ASSISTANT_NOT_MEDICAL_ADVICE)).toBe(true);
  });
});

describe("ASSISTANT_CARD_WORDS", () => {
  // Each word with the board that prints it, as the card kit takes it: the tick's name, the badges, the
  // Undo button, its plain-words twin, and the title of a card after an Undo.
  it.each([
    { name: "matchedLabel", board: "assistant · recipe-import", word: "Matched" },
    { name: "notMatchedLabel", board: "assistant · recipe-unresolved", word: "Not matched" },
    { name: "estimateLabel", board: "assistant · recipe-import", word: "Estimate" },
    { name: "undoLabel", board: "assistant-card · logged", word: "Undo" },
    { name: "cannotUndoLabel", board: "assistant-card · undo-unavailable", word: "Can't undo" },
    { name: "undoneTitle", board: "assistant-card · undone", word: "Undone" },
  ] as const)("should word $name as $board prints it", ({ name, word }) => {
    expect(ASSISTANT_CARD_WORDS[name]).toBe(word);
  });

  it("should hold only the words the card kit takes", () => {
    expect(Object.keys(ASSISTANT_CARD_WORDS).sort()).toEqual([
      "cannotUndoLabel",
      "estimateLabel",
      "matchedLabel",
      "notMatchedLabel",
      "undoLabel",
      "undoneTitle",
    ]);
  });
});
