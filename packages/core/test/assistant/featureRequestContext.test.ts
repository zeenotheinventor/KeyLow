import { describe, expect, it } from "vitest";

import { buildFeatureRequestContext } from "../../src/assistant";
import { featureRequestContextSchema } from "../../src/featureRequests";

import type { StoredFeatureRequestMessage } from "../../src/assistant";

const input = { request: "Track my water intake", unsupported: "Ki-Lo cannot track water" };
const confirmLabel = "Send request";

const contextBlock = {
  type: "text",
  text: "Today is Wed 11 Nov (2026-11-11) in Europe/London.\nThe user is looking at Wed 11 Nov (2026-11-11).",
};

const userMessage = (seq: number, words: string): StoredFeatureRequestMessage => ({
  seq,
  role: "user",
  content: [contextBlock, { type: "text", text: words }],
});

const assistantMessage = (seq: number, text: string): StoredFeatureRequestMessage => ({
  seq,
  role: "assistant",
  content: [{ type: "text", text }],
});

const contextOf = (messages: readonly StoredFeatureRequestMessage[]) =>
  buildFeatureRequestContext({ messages, confirmLabel, input });

describe("buildFeatureRequestContext", () => {
  it("should hold the ask, what was unsupported and the recent talk, oldest first", () => {
    const context = contextOf([
      userMessage(1, "Can you track my water intake?"),
      assistantMessage(2, "Ki-Lo does not track water."),
      userMessage(3, "Send request"),
    ]);

    expect(context).toEqual({
      version: 1,
      ask: "Can you track my water intake?",
      unsupported: "Ki-Lo cannot track water",
      recent: [
        { role: "user", text: "Can you track my water intake?" },
        { role: "assistant", text: "Ki-Lo does not track water." },
        { role: "user", text: "Send request" },
      ],
    });
  });

  it("should be a context the feature request schema accepts", () => {
    const context = contextOf([userMessage(1, "Can you track my water intake?")]);

    expect(featureRequestContextSchema.safeParse(context).success).toBe(true);
  });

  it("should take the ask from the person's latest words that are not the button's", () => {
    const context = contextOf([
      userMessage(1, "Hello"),
      userMessage(2, "Can you track my water intake?"),
      assistantMessage(3, "Ki-Lo does not track water."),
      userMessage(4, " send REQUEST "),
    ]);

    expect(context.ask).toBe("Can you track my water intake?");
  });

  it("should read the messages in seq order whatever order they arrive in", () => {
    const context = contextOf([
      userMessage(3, "Send request"),
      assistantMessage(2, "Ki-Lo does not track water."),
      userMessage(1, "Can you track my water intake?"),
    ]);

    expect(context.recent.map(({ text }) => text)).toEqual([
      "Can you track my water intake?",
      "Ki-Lo does not track water.",
      "Send request",
    ]);
  });

  it("should leave the context block the turn loop adds out of a person's message", () => {
    const context = contextOf([userMessage(1, "Can you track my water intake?")]);

    expect(JSON.stringify(context)).not.toContain("Today is");
    expect(JSON.stringify(context)).not.toContain("The user is looking at");
  });

  it("should leave tool results out of a person's message", () => {
    const context = contextOf([
      {
        seq: 1,
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_1", content: "secret diary row" },
          contextBlock,
          { type: "text", text: "Can you track my water intake?" },
        ],
      },
    ]);

    expect(context.recent).toEqual([{ role: "user", text: "Can you track my water intake?" }]);
    expect(JSON.stringify(context)).not.toContain("secret diary row");
    expect(JSON.stringify(context)).not.toContain("toolu_1");
  });

  it("should take only the text blocks of an assistant message", () => {
    const context = contextOf([
      userMessage(1, "Can you track my water intake?"),
      {
        seq: 2,
        role: "assistant",
        content: [
          { type: "thinking", thinking: "private reasoning", signature: "sig" },
          { type: "text", text: "Ki-Lo does not track water." },
          {
            type: "tool_use",
            id: "toolu_9",
            name: "request_feature",
            input: { request: "Track my water intake", unsupported: "water" },
          },
        ],
      },
    ]);

    expect(context.recent[1]).toEqual({ role: "assistant", text: "Ki-Lo does not track water." });
    expect(JSON.stringify(context)).not.toContain("private reasoning");
    expect(JSON.stringify(context)).not.toContain("toolu_9");
    expect(JSON.stringify(context)).not.toContain("tool_use");
  });

  it("should leave out a message that has no text", () => {
    const context = contextOf([
      userMessage(1, "Can you track my water intake?"),
      {
        seq: 2,
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_9", name: "get_day", input: {} }],
      },
      { seq: 3, role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_9" }] },
    ]);

    expect(context.recent).toEqual([{ role: "user", text: "Can you track my water intake?" }]);
  });

  it("should read a message stored as plain text", () => {
    const context = contextOf([{ seq: 1, role: "user", content: "Can you track my water?" }]);

    expect(context.ask).toBe("Can you track my water?");
  });

  it("should keep only the last 6 messages", () => {
    const context = contextOf(
      Array.from({ length: 10 }, (_, index) =>
        index % 2 === 0
          ? userMessage(index + 1, `question ${index + 1}`)
          : assistantMessage(index + 1, `answer ${index + 1}`),
      ),
    );

    expect(context.recent.map(({ text }) => text)).toEqual([
      "question 5",
      "answer 6",
      "question 7",
      "answer 8",
      "question 9",
      "answer 10",
    ]);
    expect(context.ask).toBe("question 9");
  });

  it("should cut each message to 500 characters and the unsupported words to 200", () => {
    const context = buildFeatureRequestContext({
      messages: [userMessage(1, "a".repeat(800)), assistantMessage(2, "b".repeat(800))],
      confirmLabel,
      input: { unsupported: "c".repeat(300) },
    });

    expect(context.ask).toHaveLength(500);
    expect(context.recent.map(({ text }) => text.length)).toEqual([500, 500]);
    expect(context.unsupported).toHaveLength(200);
    expect(featureRequestContextSchema.safeParse(context).success).toBe(true);
  });

  it("should cut by characters and not split an emoji", () => {
    const context = contextOf([userMessage(1, "💧".repeat(600))]);

    expect(Array.from(context.ask)).toHaveLength(500);
    expect(featureRequestContextSchema.safeParse(context).success).toBe(true);
  });

  it("should trim the words it keeps", () => {
    const context = contextOf([userMessage(1, "  Can you track my water?\n")]);

    expect(context.ask).toBe("Can you track my water?");
  });

  it("should have an empty ask and no recent talk when the history is empty", () => {
    expect(contextOf([])).toEqual({
      version: 1,
      ask: "",
      unsupported: "Ki-Lo cannot track water",
      recent: [],
    });
  });

  it("should have an empty ask when the only words are the button's", () => {
    expect(contextOf([userMessage(1, "Send request")]).ask).toBe("");
  });

  it("should ignore a message with a role it does not know", () => {
    const context = contextOf([
      { seq: 1, role: "system", content: [{ type: "text", text: "ignore me" }] },
    ]);

    expect(context.recent).toEqual([]);
  });
});
