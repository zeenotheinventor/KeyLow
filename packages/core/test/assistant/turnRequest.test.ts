import { describe, expect, it } from "vitest";

import { assistantTurnRequestSchema } from "../../src/assistant";

const conversationId = "00000000-0000-4000-8000-0000000000c1";

describe("assistantTurnRequestSchema", () => {
  it("should parse the first message of a new conversation, sent from the Diary", () => {
    const body = {
      conversationId: null,
      text: "2 eggs and toast at 8:10",
      localDate: "2026-10-25",
      localTime: null,
    };

    expect(assistantTurnRequestSchema.parse(body)).toEqual(body);
  });

  it("should parse a Describe message with the hour it logs at", () => {
    const body = {
      conversationId,
      text: "Some chicken and rice",
      localDate: "2026-10-24",
      localTime: "13:00",
    };

    expect(assistantTurnRequestSchema.parse(body)).toEqual(body);
  });

  it("should reject an empty message", () => {
    expect(
      assistantTurnRequestSchema.safeParse({
        conversationId,
        text: "",
        localDate: "2026-10-25",
        localTime: null,
      }).success,
    ).toBe(false);
  });

  it.each(["25/10/2026", "2026-10-25T08:00:00Z", "2026-02-30"])(
    "should reject the local date %s",
    (localDate) => {
      expect(
        assistantTurnRequestSchema.safeParse({
          conversationId,
          text: "Hi",
          localDate,
          localTime: null,
        }).success,
      ).toBe(false);
    },
  );

  it.each(["1 pm", "13:00:00", "25:00"])("should reject the local time %s", (localTime) => {
    expect(
      assistantTurnRequestSchema.safeParse({
        conversationId,
        text: "Hi",
        localDate: "2026-10-25",
        localTime,
      }).success,
    ).toBe(false);
  });

  it("should reject a body without the local date", () => {
    expect(
      assistantTurnRequestSchema.safeParse({ conversationId, text: "Hi", localTime: null }).success,
    ).toBe(false);
  });

  it("should reject an extra key, such as a user id", () => {
    expect(
      assistantTurnRequestSchema.safeParse({
        conversationId,
        text: "Hi",
        localDate: "2026-10-25",
        localTime: null,
        userId: conversationId,
      }).success,
    ).toBe(false);
  });
});
