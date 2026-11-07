import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ASSISTANT_CARD_WORDS,
  ASSISTANT_CONSENT_CARD,
  ASSISTANT_NOT_MEDICAL_ADVICE,
  ASSISTANT_OFFLINE,
  ASSISTANT_STOPPED,
  describeAssistantNotice,
  describeAssistantStatus,
  describeResetTime,
  safeWordsToShow,
} from "../../src/copy";

// Checked by `tsc` (the package's typecheck script), not at runtime: the consent notice is not a notice,
// because its words are the consent card's.
expectTypeOf<{ code: "consent_needed" }>().not.toExtend<
  Parameters<typeof describeAssistantNotice>[0]
>();

describe("describeAssistantNotice", () => {
  it("should word the day limit as assistant · day-limit prints it", () => {
    expect(
      describeAssistantNotice(
        { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
        "Europe/London",
      ),
    ).toEqual({
      title: "You have used today's turns",
      body: "The assistant is back at midnight. Logging, search and quick add work as normal.",
      fieldText: "Back at midnight",
      button: null,
    });
  });

  it("should word the day limit's time in British Summer Time as 1 am", () => {
    const dayLimit = describeAssistantNotice(
      { code: "day_limit", resetsAt: "2026-07-02T00:00:00Z" },
      "Europe/London",
    );

    expect([dayLimit.body, dayLimit.fieldText]).toEqual([
      "The assistant is back at 1 am. Logging, search and quick add work as normal.",
      "Back at 1 am",
    ]);
  });

  it("should word the missing entitlement as assistant · plus prints it", () => {
    expect(describeAssistantNotice({ code: "plus" }, "Europe/London")).toEqual({
      title: "The assistant is part of Ki-Lo Plus",
      body: "Your account does not include Ki-Lo Plus at the moment. Logging, search and quick add work as normal.",
      fieldText: "Not on your account",
      button: null,
    });
  });

  it("should word resting until 1 November as assistant · resting prints it", () => {
    expect(
      describeAssistantNotice({ code: "resting", resumesOn: "2026-11-01" }, "Europe/London"),
    ).toEqual({
      title: "The assistant is resting until 1 November",
      body: "It has reached this month's limit. Your conversations are kept. Everything else in Ki-Lo works as normal.",
      fieldText: "Back on 1 November",
      button: null,
    });
  });

  it("should build the resting day from resumesOn", () => {
    const resting = describeAssistantNotice(
      { code: "resting", resumesOn: "2027-01-01" },
      "Europe/London",
    );

    expect([resting.title, resting.fieldText]).toEqual([
      "The assistant is resting until 1 January",
      "Back on 1 January",
    ]);
  });

  it("should word the kill switch as assistant · unavailable (left) prints it", () => {
    expect(describeAssistantNotice({ code: "switched_off" }, "Europe/London")).toEqual({
      title: "The assistant is switched off for now",
      body: "Try again later. Everything else in Ki-Lo works as normal.",
      fieldText: "Switched off for now",
      button: null,
    });
  });

  it("should word a failed turn as assistant · unavailable (middle) prints it, composer left on", () => {
    expect(describeAssistantNotice({ code: "turn_failed" }, "Europe/London")).toEqual({
      title: "That answer did not come through",
      body: "Nothing was changed. Check your connection and try again.",
      fieldText: null,
      button: "Try again",
    });
  });
});

describe("describeResetTime", () => {
  // The server resets at midnight UTC, so the same instant reads differently in each person's zone.
  it.each([
    { zone: "Europe/London", resetsAt: "2026-10-26T00:00:00Z", words: "midnight" },
    { zone: "UTC", resetsAt: "2026-10-26T00:00:00Z", words: "midnight" },
    { zone: "Europe/London", resetsAt: "2026-07-02T00:00:00Z", words: "1 am" },
    { zone: "America/New_York", resetsAt: "2026-12-02T00:00:00Z", words: "7 pm" },
    { zone: "Pacific/Auckland", resetsAt: "2026-07-02T00:00:00Z", words: "noon" },
    { zone: "Asia/Kolkata", resetsAt: "2026-07-02T00:00:00Z", words: "5:30 am" },
    { zone: "Asia/Tokyo", resetsAt: "2026-07-02T00:00:00Z", words: "9 am" },
  ])("should read $resetsAt in $zone as $words", ({ zone, resetsAt, words }) => {
    expect(describeResetTime(resetsAt, zone)).toBe(words);
  });

  it("should read it in UTC when the time zone is not one", () => {
    expect(describeResetTime("2026-07-02T00:00:00Z", "Not/AZone")).toBe("midnight");
  });
});

// One row per line of the approved words list: the tools that share a line, then the words before and
// after the confirm button. A tool whose row has one set of words says it before and after.
const toolWords: [string[], string, string][] = [
  [["search_foods", "get_food"], "Looking up the food", "Looking up the food"],
  [["get_day", "get_entries", "get_range_totals"], "Checking your diary", "Checking your diary"],
  [["get_weigh_ins"], "Checking your weigh-ins", "Checking your weigh-ins"],
  [["get_recipes"], "Checking your recipes", "Checking your recipes"],
  [["log_entry"], "Logging your food", "Logging your food"],
  [["update_entry"], "Updating your diary", "Updating your diary"],
  [["set_day_complete"], "Marking the day complete", "Marking the day complete"],
  [["create_custom_food"], "Saving the food", "Saving the food"],
  [["create_recipe", "update_recipe"], "Saving the recipe", "Saving the recipe"],
  [["delete_entry"], "Looking at the entry", "Removing the entry"],
  [["copy_day"], "Looking at the day", "Copying the day"],
  [["archive_recipe"], "Looking at the recipe", "Archiving the recipe"],
  [["update_targets"], "Looking at your targets", "Changing your targets"],
  [["search_exercises"], "Looking up exercises", "Looking up exercises"],
  [["get_workouts"], "Checking your workouts", "Checking your workouts"],
  [["get_exercise_progress"], "Checking your progress", "Checking your progress"],
  [["get_routines"], "Checking your routines", "Checking your routines"],
  [["get_training_goals"], "Checking your goals", "Checking your goals"],
  [["get_muscle_state"], "Checking your recovery", "Checking your recovery"],
  [["suggest_next_session"], "Working out what to train", "Working out what to train"],
  [["edit_routine"], "Looking at the routine", "Changing the routine"],
  [["set_active_routine"], "Changing your active routine", "Changing your active routine"],
  [["archive_routine"], "Looking at the routine", "Archiving the routine"],
  [["create_routine"], "Building your routine", "Building your routine"],
  [["update_training_goals"], "Saving your goals", "Saving your goals"],
  [["save_custom_exercise"], "Saving the exercise", "Saving the exercise"],
  [["archive_custom_exercise"], "Looking at the exercise", "Archiving the exercise"],
  [["update_past_set"], "Updating the set", "Updating the set"],
  [["delete_workout"], "Looking at the workout", "Removing the workout"],
];

describe("describeAssistantStatus", () => {
  it("should word reading a recipe as assistant · recipe-import (left) prints it", () => {
    expect(describeAssistantStatus({ code: "reading_recipe", host: "example.com" })).toBe(
      "Reading the recipe at example.com",
    );
  });

  it("should word the default step as Thinking", () => {
    expect(describeAssistantStatus({ code: "thinking" })).toBe("Thinking");
  });

  describe.each(toolWords)("the tools %j", (tools, beforeConfirm, afterConfirm) => {
    it.each(tools)("should word %s before the confirm button", (tool) => {
      expect(describeAssistantStatus({ code: "tool", tool, food: null, isConfirmed: false })).toBe(
        beforeConfirm,
      );
    });

    it.each(tools)("should word %s after the confirm button", (tool) => {
      expect(describeAssistantStatus({ code: "tool", tool, food: null, isConfirmed: true })).toBe(
        afterConfirm,
      );
    });
  });

  it("should word a tool with food words as Looking up the food words", () => {
    expect(
      describeAssistantStatus({
        code: "tool",
        tool: "search_foods",
        food: "toast",
        isConfirmed: false,
      }),
    ).toBe("Looking up toast");
  });

  it.each([" ", "\n\t", "\u202E"])(
    "should word food of %j, which holds no words, as the food",
    (food) => {
      expect(
        describeAssistantStatus({ code: "tool", tool: "search_foods", food, isConfirmed: false }),
      ).toBe("Looking up the food");
    },
  );

  it("should clean the food words it draws", () => {
    expect(
      describeAssistantStatus({
        code: "tool",
        tool: "search_foods",
        food: "  peanut\nbutter\u202E ",
        isConfirmed: false,
      }),
    ).toBe("Looking up peanut butter");
  });

  it.each(["ask_user", "import_recipe_from_url", "constructor", "toString", "future_tool"])(
    "should word the tool %s, which has no row, as Thinking",
    (tool) => {
      expect(describeAssistantStatus({ code: "tool", tool, food: null, isConfirmed: false })).toBe(
        "Thinking",
      );
    },
  );
});

describe("safeWordsToShow", () => {
  it.each([[undefined], [null], [42], [{ food: "toast" }], [["toast"]]])(
    "should give null for %j, which is not a string",
    (input) => {
      expect(safeWordsToShow(input)).toBeNull();
    },
  );

  it.each([[""], ["   "], ["\u0000\u001f\u007f"], ["\n\t \r"]])(
    "should give null for %j, which holds no words",
    (input) => {
      expect(safeWordsToShow(input)).toBeNull();
    },
  );

  it("should keep plain words as they are", () => {
    expect(safeWordsToShow("wholemeal toast")).toBe("wholemeal toast");
  });

  it("should take control characters out", () => {
    expect(safeWordsToShow("toa\u0000st\u001b[31m")).toBe("toast[31m");
  });

  it("should collapse a newline and tabs to one space and trim the ends", () => {
    expect(safeWordsToShow("  peanut\n\t\tbutter\t ")).toBe("peanut butter");
  });

  it.each([
    ["a left-to-right embedding", "\u202A"],
    ["a right-to-left override", "\u202E"],
    ["an isolate", "\u2066"],
    ["a pop directional isolate", "\u2069"],
    ["a left-to-right mark", "\u200E"],
    ["a right-to-left mark", "\u200F"],
    ["an Arabic letter mark", "\u061C"],
    ["a zero-width space", "\u200B"],
    ["a word joiner", "\u2060"],
    ["a byte order mark", "\uFEFF"],
  ])("should take out %s, and give null when nothing else is left", (_name, character) => {
    expect(safeWordsToShow(`to${character}ast`)).toBe("toast");
    expect(safeWordsToShow(`${character}${character}`)).toBeNull();
    expect(safeWordsToShow(` ${character} `)).toBeNull();
  });

  it("should keep a zero-width joiner, which joins an emoji", () => {
    expect(safeWordsToShow("👩\u200D💻")).toBe("👩\u200D💻");
  });

  it("should give null for a lone half of a surrogate pair", () => {
    expect(safeWordsToShow("\uD83D")).toBeNull();
  });

  it("should cut a huge input at 60 code points", () => {
    expect(safeWordsToShow("a".repeat(1_000_000))).toBe("a".repeat(60));
  });

  it("should cut 61 emoji at 60 without breaking a pair", () => {
    const words = safeWordsToShow("🍞".repeat(61));

    expect(words).toBe("🍞".repeat(60));
  });

  it("should leave 60 code points whole", () => {
    expect(safeWordsToShow("a".repeat(60))).toBe("a".repeat(60));
  });

  it("should not end on a space when the cut falls after one", () => {
    expect(safeWordsToShow(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
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
        "The assistant answers questions about your diary, weight, targets and training. It logs, copies and changes entries for you, builds and changes your routines, and changes your training goals, custom exercises and past workouts. Every change shows as a card with Undo.",
        "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
      ],
      privacyLinkLabel: "Privacy policy",
      smallPrint:
        "The assistant's answers are not medical advice. Speak to a doctor before you make big changes to your diet, your weight or your training. You can turn the assistant off in More, Assistant.",
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
    {
      name: "waitUndoLabel",
      board: "assistant-card · undo-unavailable-training",
      word: "Can't undo yet",
    },
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
      "waitUndoLabel",
    ]);
  });
});
