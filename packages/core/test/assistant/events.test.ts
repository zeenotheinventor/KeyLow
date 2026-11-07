import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import { assistantStreamEventSchema } from "../../src/assistant";

const turnId = "00000000-0000-4000-8000-0000000000a1";
const conversationId = "00000000-0000-4000-8000-0000000000c1";
const confirmationId = "00000000-0000-4000-8000-0000000000f1";

// One hand-written event per type, with the board words where a board shows them. Every event is
// checked three ways below: it parses, an extra key is rejected, and each missing field is rejected.
const eventFixtures = [
  { type: "turn", turnId, conversationId },
  { type: "text", delta: "Yesterday, Saturday 24 October, you logged 8 entries" },
  { type: "status", code: "reading_recipe", host: "example.com" },
  { type: "status", code: "thinking" },
  { type: "status", code: "tool", tool: "search_foods", food: "toast", isConfirmed: false },
  { type: "card", card: loggedCard },
  {
    type: "clarify",
    question: "How much chicken and how much rice? Pick one, or say it your way.",
    quickReplies: [
      "1 chicken breast, 150 g rice",
      "1 chicken breast, 200 g rice",
      "2 chicken thighs, 200 g rice",
    ],
    fieldHint: "Or say it your way",
  },
  {
    type: "confirm",
    confirmationId,
    question: "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and an apple.",
    confirmLabel: "Delete 3 entries",
    cancelLabel: "Keep them",
    tone: "danger",
  },
  {
    type: "answer_meta",
    citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
    estimate: "Trend weight is an estimate",
  },
  { type: "notice", notice: { code: "resting", resumesOn: "2026-11-01" } },
  { type: "done", outcome: "complete" },
];

describe.each(eventFixtures)("assistantStreamEventSchema, the $type event", (event) => {
  it("should parse", () => {
    expect(assistantStreamEventSchema.parse(event)).toEqual(event);
  });

  it("should reject an extra key", () => {
    expect(assistantStreamEventSchema.safeParse({ ...event, userId: turnId }).success).toBe(false);
  });

  const requiredFields = Object.keys(event).filter((field) => field !== "type");

  it.each(requiredFields)("should reject the event without %s", (field) => {
    const withoutField = Object.fromEntries(Object.entries(event).filter(([key]) => key !== field));

    expect(assistantStreamEventSchema.safeParse(withoutField).success).toBe(false);
  });
});

describe("assistantStreamEventSchema, any event", () => {
  it("should reject an unknown type", () => {
    expect(assistantStreamEventSchema.safeParse({ type: "thinking", delta: "Hmm" }).success).toBe(
      false,
    );
  });

  it("should reject a turn id that is not a uuid", () => {
    expect(
      assistantStreamEventSchema.safeParse({ type: "turn", turnId: "turn-1", conversationId })
        .success,
    ).toBe(false);
  });

  it("should reject a status with a code the app does not know", () => {
    expect(assistantStreamEventSchema.safeParse({ type: "status", code: "dreaming" }).success).toBe(
      false,
    );
  });

  it("should reject a thinking status that carries a host", () => {
    expect(
      assistantStreamEventSchema.safeParse({
        type: "status",
        code: "thinking",
        host: "example.com",
      }).success,
    ).toBe(false);
  });

  it("should parse a tool status with no food words", () => {
    const status = { type: "status", code: "tool", tool: "get_day", food: null, isConfirmed: true };

    expect(assistantStreamEventSchema.parse(status)).toEqual(status);
  });

  it("should reject a tool status with an empty tool name", () => {
    expect(
      assistantStreamEventSchema.safeParse({
        type: "status",
        code: "tool",
        tool: "",
        food: null,
        isConfirmed: false,
      }).success,
    ).toBe(false);
  });

  it("should reject a tool status whose food is longer than 120 units", () => {
    const status = { type: "status", code: "tool", tool: "search_foods", isConfirmed: false };

    expect(assistantStreamEventSchema.safeParse({ ...status, food: "a".repeat(120) }).success).toBe(
      true,
    );
    expect(assistantStreamEventSchema.safeParse({ ...status, food: "a".repeat(121) }).success).toBe(
      false,
    );
  });

  it("should reject a status with no host to word the reading line from", () => {
    expect(
      assistantStreamEventSchema.safeParse({ type: "status", code: "reading_recipe", host: "" })
        .success,
    ).toBe(false);
  });

  it("should parse a clarifying question with no quick replies and no field hint", () => {
    const clarify = {
      type: "clarify",
      question: "How many grams?",
      quickReplies: [],
      fieldHint: null,
    };

    expect(assistantStreamEventSchema.parse(clarify)).toEqual(clarify);
  });

  it("should reject a clarifying question with more than 3 quick replies", () => {
    expect(
      assistantStreamEventSchema.safeParse({
        type: "clarify",
        question: "How much rice?",
        quickReplies: ["100 g", "150 g", "200 g", "250 g"],
        fieldHint: null,
      }).success,
    ).toBe(false);
  });

  it("should parse a confirm question in the primary tone", () => {
    const confirm = {
      type: "confirm",
      confirmationId,
      question: "Archive Chicken and rice?",
      confirmLabel: "Archive recipe",
      cancelLabel: "Keep it",
      tone: "primary",
    };

    expect(assistantStreamEventSchema.parse(confirm)).toEqual(confirm);
  });

  it("should reject a confirm tone the plan does not list", () => {
    expect(
      assistantStreamEventSchema.safeParse({
        type: "confirm",
        confirmationId,
        question: "Archive Chicken and rice?",
        confirmLabel: "Archive recipe",
        cancelLabel: "Keep it",
        tone: "secondary",
      }).success,
    ).toBe(false);
  });

  it("should parse an answer with a citation and no estimate label", () => {
    const answerMeta = {
      type: "answer_meta",
      citation: "Based on 38 entries, 12 to 18 Oct",
      estimate: null,
    };

    expect(assistantStreamEventSchema.parse(answerMeta)).toEqual(answerMeta);
  });

  it("should reject a notice event carrying a notice the schema rejects", () => {
    expect(
      assistantStreamEventSchema.safeParse({ type: "notice", notice: { code: "day_limit" } })
        .success,
    ).toBe(false);
  });

  it("should reject a card event carrying a card the schema rejects", () => {
    expect(
      assistantStreamEventSchema.safeParse({ type: "card", card: { ...loggedCard, actionIds: [] } })
        .success,
    ).toBe(false);
  });

  it.each(["complete", "clarify", "confirm", "failed"])(
    "should parse a turn done as %s",
    (outcome) => {
      expect(assistantStreamEventSchema.parse({ type: "done", outcome })).toEqual({
        type: "done",
        outcome,
      });
    },
  );

  it("should reject a done outcome the plan does not list, such as stopped", () => {
    expect(assistantStreamEventSchema.safeParse({ type: "done", outcome: "stopped" }).success).toBe(
      false,
    );
  });
});
