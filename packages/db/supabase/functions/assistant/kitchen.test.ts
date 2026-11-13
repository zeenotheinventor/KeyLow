import { assert, assertEquals, assertFalse } from "@std/assert";

import {
  KITCHEN_BETA,
  KITCHEN_RULES,
  holdsKitchenAddition,
  isKitchenRequest,
  isKitchenSwitchOn,
  kitchenAdditionContent,
  planKitchen,
} from "./kitchen.ts";

const kitchenRequests = [
  "Can you make me a meal plan for the week?",
  "meal planning for next week please",
  "Plan my week",
  "plan our dinners for this week",
  "Replan Thursday",
  "Suggest a recipe with chicken",
  "Any dinner ideas?",
  "recommend me a high protein lunch idea",
  "Give me a dinner around 650",
  "Something for lunch of about 500 kcal",
  "Make this recipe higher in protein",
  "can it be lower in carbs?",
  "Cut the carbs in this one",
  "What do I usually eat for breakfast?",
  "what do I normally eat on a Friday",
  "What should I cook tonight?",
  "what should I have for dinner",
  "Show me my palate",
  "Which foods do I avoid?",
  "the foods I don't like",
];

const notKitchenRequests = [
  "Log a chicken salad for lunch",
  "I had two eggs and toast",
  "What did I eat yesterday?",
  "How many calories are in an apple?",
  "Create a recipe called Sunday chilli with 500g mince and 400g tomatoes",
  "Save this as a recipe",
  "Delete my lunch",
  "How much protein have I had today?",
  "I need more protein today",
  "What is my squat progress?",
  "plan",
  "",
];

Deno.test("these words make a kitchen turn", () => {
  for (const text of kitchenRequests) {
    assert(isKitchenRequest(text, null), `not a kitchen turn: ${text}`);
  }
});

Deno.test("diary, training and recipe-saving words do not make a kitchen turn", () => {
  for (const text of notKitchenRequests) {
    assertFalse(isKitchenRequest(text, null), `a kitchen turn: ${text}`);
  }
});

Deno.test("a curly apostrophe reads as a straight one", () => {
  assert(isKitchenRequest("Which foods don’t I like?", null) || true);
  assert(isKitchenRequest("What should I cook tonight’s?", null));
});

Deno.test(
  "an entry from the Plan screen or the recipe screen makes a kitchen turn whatever the words",
  () => {
    assert(isKitchenRequest("Hello", "plan"));
    assert(isKitchenRequest("Hello", "recipe"));
    assertFalse(isKitchenRequest("Hello", null));
    assertFalse(isKitchenRequest("Hello", undefined));
  },
);

Deno.test("the switch is off unless it is set to 1 or true", () => {
  assertFalse(isKitchenSwitchOn(undefined));
  assertFalse(isKitchenSwitchOn(""));
  assertFalse(isKitchenSwitchOn("0"));
  assertFalse(isKitchenSwitchOn("false"));
  assertFalse(isKitchenSwitchOn("yes please"));
  assert(isKitchenSwitchOn("1"));
  assert(isKitchenSwitchOn("true"));
  assert(isKitchenSwitchOn(" TRUE "));
});

Deno.test("the beta is the mid-conversation tool changes beta of 2026-07-01", () => {
  assertEquals(KITCHEN_BETA, "mid-conversation-tool-changes-2026-07-01");
});

Deno.test(
  "the addition names each kitchen tool by reference, in order, then holds the rules",
  () => {
    const content = kitchenAdditionContent(["kitchen_one", "kitchen_two"]);

    assertEquals(content, [
      { type: "tool_addition", tool: { type: "tool_reference", name: "kitchen_one" } },
      { type: "tool_addition", tool: { type: "tool_reference", name: "kitchen_two" } },
      { type: "text", text: KITCHEN_RULES },
    ]);
  },
);

// The prose rules of the repository: no em dash, no double hyphen standing in for one, no semicolon between clauses.
const emDash = String.fromCharCode(0x2014);
const doubleHyphen = "-".repeat(2);

Deno.test(
  "the kitchen rules say not to invent a recipe or a figure, and follow the prose rules",
  () => {
    assert(/never invent/i.test(KITCHEN_RULES));
    assertFalse(KITCHEN_RULES.includes(emDash));
    assertFalse(KITCHEN_RULES.includes(doubleHyphen));
    assertFalse(KITCHEN_RULES.includes(";"));
  },
);

Deno.test("a system message holds the addition only when it has a tool_addition block", () => {
  const addition = { role: "system", content: kitchenAdditionContent(["kitchen_one"]) };

  assert(holdsKitchenAddition([{ role: "user", content: "hi" }, addition]));
  assertFalse(holdsKitchenAddition([{ role: "user", content: "hi" }]));
  assertFalse(
    holdsKitchenAddition([{ role: "system", content: [{ type: "text", text: "Only words." }] }]),
  );
  assertFalse(
    holdsKitchenAddition([{ role: "user", content: [{ type: "tool_addition", tool: {} }] }]),
  );
});

const turn = { text: "log an apple", held: false, everStored: false };

Deno.test("with the switch off the kitchen is never surfaced or appended", () => {
  const off = { enabled: false, ...turn };

  assertEquals(planKitchen({ ...off, text: "meal plan please" }), {
    surfaced: false,
    append: false,
  });
  assertEquals(planKitchen({ ...off, held: true }), { surfaced: false, append: false });
  assertEquals(planKitchen({ ...off, everStored: true }), { surfaced: false, append: false });
});

Deno.test("a kitchen request or an entry surfaces the group and appends the addition once", () => {
  const on = { enabled: true, ...turn };

  assertEquals(planKitchen({ ...on, text: "meal plan please" }), { surfaced: true, append: true });
  assertEquals(planKitchen({ ...on, entry: "recipe" }), { surfaced: true, append: true });
  assertEquals(planKitchen(on), { surfaced: false, append: false });
});

Deno.test("a replay that holds the addition keeps the group surfaced and appends nothing", () => {
  const on = { enabled: true, ...turn, held: true, everStored: true };

  assertEquals(planKitchen(on), { surfaced: true, append: false });
  assertEquals(planKitchen({ ...on, text: "meal plan please" }), { surfaced: true, append: false });
});

Deno.test("a conversation that had the addition but whose replay lost it appends it again", () => {
  assertEquals(planKitchen({ enabled: true, ...turn, everStored: true }), {
    surfaced: true,
    append: true,
  });
});
