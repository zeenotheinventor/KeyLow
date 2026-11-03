import { describe, expect, it } from "vitest";

import { toolCallsOf } from "../src/httpSession.ts";

describe("toolCallsOf", () => {
  it("should keep the tool_use blocks of a stored message, in order, and leave the text out", () => {
    const content = [
      { type: "text", text: "Looking." },
      { type: "tool_use", id: "toolu_1", name: "search_foods", input: { q: "egg" } },
      { type: "tool_use", id: "toolu_2", name: "get_food", input: { id: "x" } },
    ];

    expect(toolCallsOf(content)).toEqual([
      { name: "search_foods", input: { q: "egg" } },
      { name: "get_food", input: { id: "x" } },
    ]);
  });

  it("should answer nothing for content that is not a list of blocks", () => {
    expect(toolCallsOf(null)).toEqual([]);
    expect(toolCallsOf("text")).toEqual([]);
    expect(toolCallsOf([null, 3, { type: "tool_use" }])).toEqual([]);
  });
});
