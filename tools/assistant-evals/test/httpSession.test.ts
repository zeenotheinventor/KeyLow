import { describe, expect, it } from "vitest";

import { toolCallsOf, toolCallsOfTurn } from "../src/httpSession.ts";

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

describe("toolCallsOfTurn", () => {
  const call = (id: string, name: string) => ({ type: "tool_use", id, name, input: { q: "x" } });
  const result = (id: string, content: string, isError = false) => ({
    type: "tool_result",
    tool_use_id: id,
    content,
    ...(isError ? { is_error: true } : {}),
  });

  it("should add the error code of a refused call and nothing else of its result", () => {
    const contents = [
      [call("t1", "log_entry"), call("t2", "search_foods")],
      [
        result(
          "t1",
          '<untrusted_data tool="log_entry">{"error":"not_found"}</untrusted_data>',
          true,
        ),
        result("t2", '<untrusted_data>{"foods":[{"name":"A secret meal"}]}</untrusted_data>'),
      ],
    ];

    expect(toolCallsOfTurn(contents)).toEqual([
      { name: "log_entry", input: { q: "x" }, errorCode: "not_found" },
      { name: "search_foods", input: { q: "x" } },
    ]);
  });

  it("should read an invalid_input refusal that names fields without keeping the fields", () => {
    const contents = [
      [call("t1", "log_entry")],
      [result("t1", '{"error": "invalid_input", "fields": ["food_id"]}', true)],
    ];

    expect(toolCallsOfTurn(contents)).toEqual([
      { name: "log_entry", input: { q: "x" }, errorCode: "invalid_input" },
    ]);
  });

  it("should leave out a code when the result has none, or the content is not a list of blocks", () => {
    expect(toolCallsOfTurn([[call("t1", "get_day")], [result("t1", "{}")], "text", null])).toEqual([
      { name: "get_day", input: { q: "x" } },
    ]);
  });
});

describe("toolCallsOfTurn, what became of each call", () => {
  const call = (id: string, name: string) => ({ type: "tool_use", id, name, input: {} });
  const result = (id: string, content: string) => ({
    type: "tool_result",
    tool_use_id: id,
    content,
  });

  it("should say a call asked to confirm, from the status in its result", () => {
    const contents = [
      [call("t1", "delete_entry")],
      [
        result(
          "t1",
          '<untrusted_data source="delete_entry">{"status":"needs_confirmation","confirmation_id":"c1"}</untrusted_data>',
        ),
      ],
    ];

    expect(toolCallsOfTurn(contents)).toEqual([
      { name: "delete_entry", input: {}, outcome: "asked to confirm" },
    ]);
  });

  it("should say a call has no result, which means the loop never ran it", () => {
    expect(toolCallsOfTurn([[call("t1", "delete_entry")]])).toEqual([
      { name: "delete_entry", input: {}, outcome: "no result" },
    ]);
  });

  it("should not say it of ask_user, which the loop turns into a question and never answers", () => {
    expect(toolCallsOfTurn([[call("t1", "ask_user")]])).toEqual([{ name: "ask_user", input: {} }]);
  });

  it("should say nothing of a call that ran and answered", () => {
    expect(toolCallsOfTurn([[call("t1", "get_day")], [result("t1", '{"entries":[]}')]])).toEqual([
      { name: "get_day", input: {} },
    ]);
  });
});
