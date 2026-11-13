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

  it("should answer an invalid event for a type that is not a word", () => {
    expect(parseAssistantEvent('{"type":"Not a kind!"}')).toMatchObject({
      ok: false,
      reason: "invalid_event",
    });
  });

  it("should answer an invalid event for a type that is not a string", () => {
    expect(parseAssistantEvent('{"type":7}')).toMatchObject({
      ok: false,
      reason: "invalid_event",
    });
  });

  it("should still fail a known type whose fields are wrong", () => {
    expect(parseAssistantEvent('{"type":"text","delta":7}')).toMatchObject({
      ok: false,
      reason: "invalid_event",
    });
  });

  describe("an event type this app does not know", () => {
    it.each(["thinking", "statuses", "meal_plan_draft"])(
      "should answer unknown_kind for the type %s, with its name and nothing else",
      (type) => {
        expect(parseAssistantEvent(JSON.stringify({ type, anything: "2 eggs" }))).toEqual({
          ok: false,
          reason: "unknown_kind",
          subject: "event",
          kind: type,
        });
      },
    );

    it.each([
      "turn",
      "text",
      "status",
      "card",
      "link",
      "exercise_muscles",
      "exercise_form_media",
      "recipe_draft",
      "ask_again",
      "clarify",
      "confirm",
      "answer_meta",
      "notice",
      "done",
    ])("should not call the type %s, which it knows, an unknown kind", (type) => {
      expect(parseAssistantEvent(JSON.stringify({ type }))).not.toMatchObject({
        reason: "unknown_kind",
      });
    });
  });

  describe("a card kind this app does not know", () => {
    const withKind = (kind: string) =>
      JSON.stringify({ type: "card", card: { ...loggedCard, kind } });

    it("should answer unknown_kind for the card, with the kind's name and nothing else", () => {
      expect(parseAssistantEvent(withKind("meal_plan_archived"))).toEqual({
        ok: false,
        reason: "unknown_kind",
        subject: "card",
        kind: "meal_plan_archived",
      });
    });

    it("should answer unknown_kind even when the card holds fields this app has never seen", () => {
      const line = JSON.stringify({
        type: "card",
        card: { ...loggedCard, kind: "future_kind", days: "2 eggs", extra: { rows: 1 } },
      });

      expect(parseAssistantEvent(line)).toMatchObject({
        reason: "unknown_kind",
        kind: "future_kind",
      });
    });

    it("should never put anything of the card in the answer but the kind", () => {
      expect(JSON.stringify(parseAssistantEvent(withKind("future_kind")))).not.toContain("Eggs");
    });

    it.each(["Chicken thighs and rice for Zee", "", "x".repeat(65), "has space"])(
      "should not name the kind %j, which is not a word of ours, and fail the event instead",
      (kind) => {
        expect(parseAssistantEvent(withKind(kind))).toMatchObject({
          ok: false,
          reason: "invalid_event",
        });
      },
    );

    it("should still fail a card of a known kind whose fields are wrong", () => {
      const line = JSON.stringify({ type: "card", card: { ...loggedCard, title: "" } });

      expect(parseAssistantEvent(line)).toMatchObject({ ok: false, reason: "invalid_event" });
    });
  });

  describe("a known card whose link this app cannot read", () => {
    const withLink = (link: unknown) =>
      JSON.stringify({ type: "card", card: { ...loggedCard, link } });
    const planLink = {
      label: "Open the plan",
      target: { screen: "meal_plan", planId: "00000000-0000-4000-8000-0000000000e1" },
    };

    it("should keep the card with no link and say which screen was skipped", () => {
      expect(parseAssistantEvent(withLink(planLink))).toEqual({
        ok: true,
        event: { type: "card", card: { ...loggedCard, link: null } },
        skipped: { subject: "link", kind: "meal_plan" },
      });
    });

    it("should report a known screen with bad parameters as unreadable, not by its name", () => {
      expect(
        parseAssistantEvent(
          withLink({ label: "Open", target: { screen: "diary_day", localDate: 7 } }),
        ),
      ).toMatchObject({ ok: true, skipped: { subject: "link", kind: "unreadable" } });
    });

    it("should name no screen when the link has none that is a plain word", () => {
      expect(
        parseAssistantEvent(withLink({ label: "Open", target: { screen: "A b!" } })),
      ).toMatchObject({
        ok: true,
        skipped: { subject: "link", kind: "unreadable" },
      });
    });

    it("should not touch a card whose link reads", () => {
      const link = {
        label: "Open the day",
        target: { screen: "diary_day", localDate: "2026-11-03" },
      };

      expect(parseAssistantEvent(withLink(link))).toEqual({
        ok: true,
        event: { type: "card", card: { ...loggedCard, link } },
      });
    });

    it("should still fail a card that is wrong in a field beside the link", () => {
      const line = JSON.stringify({
        type: "card",
        card: { ...loggedCard, title: "", link: planLink },
      });

      expect(parseAssistantEvent(line)).toMatchObject({ ok: false, reason: "invalid_event" });
    });

    it("should never put the link's label in the answer", () => {
      const parsed = parseAssistantEvent(withLink(planLink));

      expect(parsed.ok && JSON.stringify(parsed.skipped)).not.toContain("Open the plan");
    });
  });

  it("should strip a field a later version adds beside the draft, and only on recipe_draft", () => {
    const draft = {
      variant: "suggestion",
      name: "Bowl",
      servings: 1,
      ingredients: [],
      dropped: [],
      perServing: { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
      fit: null,
      steps: [],
    };

    expect(parseAssistantEvent(JSON.stringify({ type: "recipe_draft", draft, later: 1 }))).toEqual({
      ok: true,
      event: { type: "recipe_draft", draft },
    });
    expect(parseAssistantEvent('{"type":"ask_again","later":1}')).toMatchObject({
      ok: false,
      reason: "invalid_event",
    });
  });

  it("should parse a recipe_draft event", () => {
    const draft = {
      variant: "suggestion",
      name: "Chicken and rice bowl",
      servings: 2,
      ingredients: [
        {
          name: "Chicken breast",
          foodId: null,
          foodName: null,
          grams: 300,
          kcal: null,
          beforeGrams: null,
          change: "same",
        },
      ],
      dropped: [],
      perServing: { kcal: 520, protein_g: 38, fat_g: 14, carbs_g: 55 },
      fit: null,
      steps: ["Cook the rice."],
    };

    expect(parseAssistantEvent(JSON.stringify({ type: "recipe_draft", draft }))).toEqual({
      ok: true,
      event: { type: "recipe_draft", draft },
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
