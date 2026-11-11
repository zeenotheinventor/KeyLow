import { describe, expect, it } from "vitest";

import {
  FEATURE_REQUEST_TEXT_MAX,
  FEATURE_REQUEST_TEXT_MIN,
  featureRequestContextSchema,
  featureRequestInputSchema,
  featureRequestSourceSchema,
  featureRequestTextSchema,
} from "../../src/featureRequests";

const context = {
  version: 1,
  ask: "Can you add a barcode for my gym card?",
  unsupported: "gym card barcodes",
  recent: [
    { role: "user", text: "Add my gym card" },
    { role: "assistant", text: "I cannot do that yet." },
  ],
};

describe("featureRequestTextSchema", () => {
  it("should hold the bounds the database checks", () => {
    expect([FEATURE_REQUEST_TEXT_MIN, FEATURE_REQUEST_TEXT_MAX]).toEqual([3, 1000]);
  });

  it("should trim the text", () => {
    expect(featureRequestTextSchema.parse("  Dark mode  ")).toBe("Dark mode");
  });

  it.each([
    ["two characters", "ab"],
    ["only spaces", "      "],
    ["1001 characters", "a".repeat(1001)],
  ])("should refuse %s", (_name, text) => {
    expect(featureRequestTextSchema.safeParse(text).success).toBe(false);
  });

  it.each([
    ["3 characters", "abc"],
    ["1000 characters", "a".repeat(1000)],
    ["1000 characters with padding", `  ${"a".repeat(1000)}  `],
  ])("should accept %s", (_name, text) => {
    expect(featureRequestTextSchema.safeParse(text).success).toBe(true);
  });

  it("should count a character outside the basic plane once, as the database does", () => {
    expect(featureRequestTextSchema.safeParse("😀".repeat(1000)).success).toBe(true);
  });
});

describe("featureRequestSourceSchema", () => {
  it.each(["assistant", "more_menu"])("should accept %s", (source) => {
    expect(featureRequestSourceSchema.parse(source)).toBe(source);
  });

  it("should refuse any other source", () => {
    expect(featureRequestSourceSchema.safeParse("web").success).toBe(false);
  });
});

describe("featureRequestContextSchema", () => {
  it("should accept a full context", () => {
    expect(featureRequestContextSchema.parse(context)).toEqual(context);
  });

  it("should accept no recent turns", () => {
    expect(featureRequestContextSchema.safeParse({ ...context, recent: [] }).success).toBe(true);
  });

  it.each([
    ["another version", { version: 2 }],
    ["an ask of 501 characters", { ask: "a".repeat(501) }],
    ["an unsupported text of 201 characters", { unsupported: "a".repeat(201) }],
    ["7 recent turns", { recent: Array.from({ length: 7 }, () => context.recent[0]) }],
    ["a turn of 501 characters", { recent: [{ role: "user", text: "a".repeat(501) }] }],
    ["a turn with another role", { recent: [{ role: "tool", text: "x" }] }],
    ["an extra key", { conversationId: "c1" }],
  ])("should refuse %s", (_name, change) => {
    expect(featureRequestContextSchema.safeParse({ ...context, ...change }).success).toBe(false);
  });

  it("should refuse an extra key on a turn", () => {
    const recent = [{ role: "user", text: "hi", toolCall: {} }];
    expect(featureRequestContextSchema.safeParse({ ...context, recent }).success).toBe(false);
  });
});

describe("featureRequestInputSchema", () => {
  it("should trim a more_menu request and give it a null context", () => {
    expect(
      featureRequestInputSchema.parse({ source: "more_menu", request: "  Dark mode " }),
    ).toEqual({
      source: "more_menu",
      request: "Dark mode",
      context: null,
    });
  });

  it("should accept an assistant request with a context", () => {
    expect(
      featureRequestInputSchema.parse({ source: "assistant", request: "Gym cards", context }),
    ).toEqual({ source: "assistant", request: "Gym cards", context });
  });

  it.each([
    ["a more_menu request with a context", { source: "more_menu", request: "Dark mode", context }],
    ["an assistant request with no context", { source: "assistant", request: "Gym cards" }],
    [
      "an assistant request with a null context",
      { source: "assistant", request: "Gym cards", context: null },
    ],
    [
      "an assistant request with a bad context",
      { source: "assistant", request: "Gym cards", context: { version: 2 } },
    ],
    ["a request that is too short", { source: "more_menu", request: "ab" }],
    ["an unknown source", { source: "web", request: "Dark mode" }],
  ])("should refuse %s", (_name, input) => {
    expect(featureRequestInputSchema.safeParse(input).success).toBe(false);
  });
});
