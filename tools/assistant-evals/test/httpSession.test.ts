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

describe("toolCallsOfTurn, the amounts estimate_portions returned", () => {
  const call = (id: string, name: string) => ({ type: "tool_use", id, name, input: {} });
  const result = (id: string, content: string) => ({
    type: "tool_result",
    tool_use_id: id,
    content,
  });
  const estimateResult =
    '<untrusted_data source="estimate_portions">{"shares_scaled":false,"items":[' +
    '{"food_id":"f1","name":"Rice, boiled","grams":180,"method":"share","kcal":211},' +
    '{"food_id":"f2","name":"Milk","ml":250,"method":"share","kcal":120},' +
    '{"food_id":"f3","error":"counted_food"}]}</untrusted_data>';

  it("should keep the food id, the unit and the amount of each sized item, and no name or nutrient", () => {
    const contents = [[call("t1", "estimate_portions")], [result("t1", estimateResult)]];

    expect(toolCallsOfTurn(contents)).toEqual([
      {
        name: "estimate_portions",
        input: {},
        estimatedAmounts: [
          { foodId: "f1", unit: "g", amount: 180 },
          { foodId: "f2", unit: "ml", amount: 250 },
        ],
      },
    ]);
  });

  it("should add nothing for another tool, a refused call or a result that is not JSON", () => {
    const contents = [
      [
        call("t1", "search_foods"),
        call("t2", "estimate_portions"),
        call("t3", "estimate_portions"),
      ],
      [
        result("t1", estimateResult),
        result("t2", '{"error":"invalid_input","fields":["items"]}'),
        result("t3", "not json"),
      ],
    ];

    const [search, refused, broken] = toolCallsOfTurn(contents);

    expect(search).not.toHaveProperty("estimatedAmounts");
    expect(refused).not.toHaveProperty("estimatedAmounts");
    expect(broken).not.toHaveProperty("estimatedAmounts");
  });
});

describe("toolCallsOfTurn, the answer of a kitchen tool", () => {
  const call = (id: string, name: string) => ({ type: "tool_use", id, name, input: {} });
  const result = (id: string, content: string) => ({
    type: "tool_result",
    tool_use_id: id,
    content,
  });

  it("should keep the parsed answer of get_palate_profile, suggest_recipe and adjust_recipe", () => {
    const contents = [
      [call("t1", "get_palate_profile"), call("t2", "suggest_recipe"), call("t3", "adjust_recipe")],
      [
        result(
          "t1",
          '<untrusted_data tool="get_palate_profile">{"logged_days":89}</untrusted_data>',
        ),
        result("t2", '<untrusted_data>{"recipe":{"servings":1}}</untrusted_data>'),
        result("t3", '{"error":"could_not_reach_target","misses":[{"nutrient":"protein_g"}]}'),
      ],
    ];

    const [profile, suggestion, adjustment] = toolCallsOfTurn(contents);

    expect(profile?.result).toEqual({ logged_days: 89 });
    expect(suggestion?.result).toEqual({ recipe: { servings: 1 } });
    expect(adjustment?.result).toEqual({
      error: "could_not_reach_target",
      misses: [{ nutrient: "protein_g" }],
    });
    expect(adjustment?.errorCode).toBe("could_not_reach_target");
  });

  it("should keep the parsed answer of plan_meals and replan_day, which graders compare with core", () => {
    const contents = [
      [call("t1", "plan_meals"), call("t2", "replan_day")],
      [
        result(
          "t1",
          '<untrusted_data tool="plan_meals">{"planned":true,"repeat_limit":{"max_repeats":2,"chosen_by":"default"}}</untrusted_data>',
        ),
        result("t2", '{"replanned":false,"reason":"day_not_planned"}'),
      ],
    ];

    const [plan, replan] = toolCallsOfTurn(contents);

    expect(plan?.result).toEqual({
      planned: true,
      repeat_limit: { max_repeats: 2, chosen_by: "default" },
    });
    expect(replan?.result).toEqual({ replanned: false, reason: "day_not_planned" });
  });

  it("should keep no answer for any other tool", () => {
    const contents = [
      [call("t1", "get_recipes")],
      [result("t1", '<untrusted_data>{"recipes":[{"name":"A secret meal"}]}</untrusted_data>')],
    ];

    expect(toolCallsOfTurn(contents)).toEqual([{ name: "get_recipes", input: {} }]);
  });

  it("should keep no answer when the text is not JSON", () => {
    const contents = [[call("t1", "get_palate_profile")], [result("t1", "not json")]];

    expect(toolCallsOfTurn(contents)[0]).not.toHaveProperty("result");
  });
});
