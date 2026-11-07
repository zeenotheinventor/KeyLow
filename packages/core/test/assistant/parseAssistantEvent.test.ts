import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import { parseAssistantEvent } from "../../src/assistant";

describe("parseAssistantEvent", () => {
  it("should answer the event for one SSE data payload", () => {
    expect(parseAssistantEvent('{"type":"text","delta":"You have 1,693 kcal"}')).toEqual({
      ok: true,
      event: { type: "text", delta: "You have 1,693 kcal" },
    });
  });

  it("should answer invalid JSON for a payload that is not JSON", () => {
    expect(parseAssistantEvent('{"type":"text",')).toEqual({
      ok: false,
      reason: "invalid_json",
      fieldPaths: [],
    });
  });

  it("should answer an invalid event with the paths of the fields that broke", () => {
    expect(parseAssistantEvent('{"type":"done","outcome":"stopped"}')).toEqual({
      ok: false,
      reason: "invalid_event",
      fieldPaths: ["outcome"],
    });
  });

  it("should answer an invalid event for an unknown type", () => {
    expect(parseAssistantEvent('{"type":"thinking"}')).toMatchObject({
      ok: false,
      reason: "invalid_event",
    });
  });

  it.each([
    ['{"type":"status","code":"thinking"}', { type: "status", code: "thinking" }],
    [
      '{"type":"status","code":"tool","tool":"get_day","food":null,"isConfirmed":false}',
      { type: "status", code: "tool", tool: "get_day", food: null, isConfirmed: false },
    ],
  ])("should parse the status %s", (line, event) => {
    expect(parseAssistantEvent(line)).toEqual({ ok: true, event });
  });

  it.each([
    ["an unknown code", '{"type":"status","code":"dreaming"}'],
    [
      "an extra key",
      '{"type":"status","code":"tool","tool":"get_day","food":null,"isConfirmed":false,"n":1}',
    ],
    [
      "a tool with no name",
      '{"type":"status","code":"tool","tool":"","food":null,"isConfirmed":false}',
    ],
    ["a status with no code", '{"type":"status"}'],
  ])(
    "should read a status with %s as thinking, so an older app never fails a turn",
    (_name, line) => {
      expect(parseAssistantEvent(line)).toEqual({
        ok: true,
        event: { type: "status", code: "thinking" },
      });
    },
  );

  it("should still fail an unknown type that looks like a status", () => {
    expect(parseAssistantEvent('{"type":"statuses","code":"thinking"}')).toMatchObject({
      ok: false,
      reason: "invalid_event",
    });
  });

  it("should name an extra key on the event, because a name is not a value", () => {
    expect(parseAssistantEvent('{"type":"done","outcome":"complete","userId":"abc"}')).toEqual({
      ok: false,
      reason: "invalid_event",
      fieldPaths: ["userId"],
    });
  });

  it("should name an extra key nested in a card row by its whole path", () => {
    const line = JSON.stringify({
      type: "card",
      card: { ...loggedCard, rows: loggedCard.rows.map((row) => ({ ...row, grams: 100 })) },
    });

    expect(parseAssistantEvent(line)).toEqual({
      ok: false,
      reason: "invalid_event",
      fieldPaths: ["card.rows.0.grams", "card.rows.1.grams"],
    });
  });

  it("should name every extra key and every broken field together", () => {
    expect(parseAssistantEvent('{"type":"done","outcome":"stopped","a":1,"b":2}')).toEqual({
      ok: false,
      reason: "invalid_event",
      fieldPaths: ["outcome", "a", "b"],
    });
  });

  it("should never put a value of the event in the error, because the text is the person's", () => {
    const result = parseAssistantEvent('{"type":"text","delta":"2 eggs","extra":"2 eggs"}');

    expect(JSON.stringify(result)).not.toContain("2 eggs");
  });

  it("should never throw, whatever the line holds", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json()), (line) => {
        expect(() => parseAssistantEvent(line)).not.toThrow();
      }),
    );
  });
});
