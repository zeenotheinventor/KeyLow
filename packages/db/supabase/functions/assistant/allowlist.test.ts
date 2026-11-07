import { assert, assertEquals } from "@std/assert";

import { toolRegistry } from "../_shared/assistant/registry.ts";
import { allowedToolsFor } from "./allowlist.ts";

import type { AllowlistTool } from "./allowlist.ts";

const read = (name: string): AllowlistTool => ({ name, readOnlyHint: true });
const write = (name: string): AllowlistTool => ({ name, readOnlyHint: false });

// The tools in a fixed order, with the import tool and a write that needs a confirmation among them.
const tools: AllowlistTool[] = [
  read("search_foods"),
  read("get_food"),
  read("get_day"),
  write("log_entry"),
  write("copy_day"),
  write("delete_entries"),
  write("create_recipe"),
  write("import_recipe_from_url"),
  read("ask_user"),
];

const allowed = (text: string, pendingConfirmationTool: string | null = null) =>
  allowedToolsFor({ text, pendingConfirmationTool, tools });

Deno.test("a message with a link gets the recipe import set, in the tools' own order", () => {
  assertEquals(allowed("Can you save https://example.com/pancakes for me"), [
    "search_foods",
    "get_food",
    "create_recipe",
    "import_recipe_from_url",
    "ask_user",
  ]);
});

Deno.test("a link wins over a question", () => {
  assertEquals(
    allowed("Is https://example.com/pancakes healthy?").includes("import_recipe_from_url"),
    true,
  );
});

Deno.test("the import set holds only the tools that are listed", () => {
  const listed = [read("search_foods"), write("import_recipe_from_url"), write("log_entry")];

  assertEquals(
    allowedToolsFor({
      text: "https://example.com/x",
      pendingConfirmationTool: null,
      tools: listed,
    }),
    ["search_foods", "import_recipe_from_url"],
  );
});

Deno.test("a question with no write word gets the read set, which holds ask_user", () => {
  for (const text of [
    "what did I eat on Monday?",
    "What's my protein today",
    "How many calories are in an egg",
    "Is salmon high in fat?",
    "Did I go over on Tuesday?",
    "how is my weight trending?",
  ]) {
    assertEquals(allowed(text), ["search_foods", "get_food", "get_day", "ask_user"], text);
  }
});

Deno.test("a message that asks for a change gets the general set, without the import tool", () => {
  const general = [
    "search_foods",
    "get_food",
    "get_day",
    "log_entry",
    "copy_day",
    "delete_entries",
    "create_recipe",
    "ask_user",
  ];

  for (const text of [
    "log two eggs",
    "delete Monday's lunch?",
    "Can you add a banana to breakfast?",
    "what did I log yesterday?",
    "copy yesterday to today",
    "UNDO that",
    "Archive the pancakes recipe",
    "2 eggs and toast at 8:10",
  ]) {
    assertEquals(allowed(text), general, text);
  }
});

Deno.test("a polite or intent request gets the general set, whatever the verb", () => {
  for (const text of [
    "Can you put two eggs on my breakfast?",
    "Could you record 2 eggs for lunch?",
    "Can you edit Monday's lunch?",
    "Can you swap the rice for pasta?",
    "Can you track my lunch?",
    "Could you save that?",
    "Can you move lunch to 14:00?",
    "Can you reset my targets?",
    "Can you increase my protein target to 150?",
    "Would you do two eggs for lunch?",
    "Will you sort my breakfast?",
    "Please sort my breakfast",
    "I want two eggs for lunch",
    "I need to fix Monday",
    "I'd like to remove the toast",
    "I would like my lunch sorted",
  ]) {
    assert(allowed(text).includes("log_entry"), text);
  }
});

Deno.test("a change verb the first list missed gets the general set", () => {
  for (const text of [
    "store this as my lunch",
    "enter 2 eggs",
    "insert a banana",
    "include the toast",
    "correct Monday",
    "rename the recipe",
    "clear Tuesday",
    "drop the toast",
    "cancel that",
    "bump my protein to 150",
    "decrease my carbs",
    "reduce the rice to 100 g",
    "adjust my target",
    "modify the recipe",
    "duplicate Monday",
    "restore the toast",
    "erase Monday",
    "wipe Tuesday",
    "replace the rice with pasta",
    "swap the rice for pasta",
  ]) {
    assert(allowed(text).includes("log_entry"), text);
  }
});

Deno.test(
  "a question-shaped message that does not open with a question word gets the general set",
  () => {
    for (const text of [
      "Two eggs and toast for breakfast?",
      "Same as yesterday?",
      "How about 2 eggs for dinner",
      "What about two eggs for lunch",
      "Eggs for lunch?",
    ]) {
      assert(allowed(text).includes("log_entry"), text);
    }
  },
);

Deno.test("a read opener gets the read set, even when it names an amount or a meal", () => {
  for (const text of [
    "what did I eat on Monday?",
    "how much protein did I have last week?",
    "How many calories are in 2 eggs?",
    "What did I have for lunch yesterday?",
  ]) {
    assertEquals(allowed(text), ["search_foods", "get_food", "get_day", "ask_user"], text);
  }
});

Deno.test("a link without a scheme also gets the import set", () => {
  for (const text of [
    "save www.example.com/pancakes",
    "save example.com/pancakes please",
    "what is in blog.example.co.uk/recipes/pancakes?",
  ]) {
    assert(allowed(text).includes("import_recipe_from_url"), text);
  }
  assertEquals(
    allowed("how many calories are in 1.5 eggs?").includes("import_recipe_from_url"),
    false,
  );
  assertEquals(allowed("I ate approx.eggs").includes("import_recipe_from_url"), false);
});

Deno.test("a write word is a whole word and not a part of another word", () => {
  assertEquals(allowed("what is in a dataset?"), [
    "search_foods",
    "get_food",
    "get_day",
    "ask_user",
  ]);
  assertEquals(allowed("how much is in an outset?"), [
    "search_foods",
    "get_food",
    "get_day",
    "ask_user",
  ]);
});

Deno.test(
  "a question after a statement is not a question, so the statement can still be logged",
  () => {
    assertEquals(allowed("I had two eggs. What is my total?").includes("log_entry"), true);
    assertEquals(allowed("two eggs\nwhat is my total?").includes("log_entry"), true);
    assertEquals(allowed("I ate two eggs, how many calories is that?").includes("log_entry"), true);
  },
);

Deno.test("an opening that is not a question word gets the general set", () => {
  assertEquals(allowed("Have two eggs for lunch").includes("log_entry"), true);
  assertEquals(allowed("hello").includes("log_entry"), true);
});

Deno.test("a pending confirmation adds its own tool to the read set", () => {
  assertEquals(allowed("what did I eat on Monday?", "copy_day"), [
    "search_foods",
    "get_food",
    "get_day",
    "copy_day",
    "ask_user",
  ]);
});

Deno.test("a pending confirmation adds its own tool to the import set", () => {
  assertEquals(allowed("https://example.com/x", "delete_entries"), [
    "search_foods",
    "get_food",
    "delete_entries",
    "create_recipe",
    "import_recipe_from_url",
    "ask_user",
  ]);
});

Deno.test("a pending confirmation for a tool that is not listed adds nothing", () => {
  assertEquals(allowed("what did I eat on Monday?", "launch_rocket"), [
    "search_foods",
    "get_food",
    "get_day",
    "ask_user",
  ]);
});

Deno.test("a pending confirmation already in the set is listed once", () => {
  assertEquals(
    allowed("log two eggs", "log_entry").filter((name) => name === "log_entry"),
    ["log_entry"],
  );
});

Deno.test("a read tool added to the list lands in the read set with no code change", () => {
  const extended = [...tools, read("get_weigh_ins")];

  assertEquals(
    allowedToolsFor({ text: "how is my weight?", pendingConfirmationTool: null, tools: extended }),
    ["search_foods", "get_food", "get_day", "ask_user", "get_weigh_ins"],
  );
});

Deno.test("a write tool added to the list lands in the general set and not the read set", () => {
  const extended = [...tools, write("update_targets")];

  assertEquals(
    allowedToolsFor({
      text: "set my target",
      pendingConfirmationTool: null,
      tools: extended,
    }).includes("update_targets"),
    true,
  );
  assertEquals(
    allowedToolsFor({
      text: "what is my target?",
      pendingConfirmationTool: null,
      tools: extended,
    }).includes("update_targets"),
    false,
  );
});

Deno.test("the answer is the same on every call for the same input", () => {
  assertEquals(allowed("log two eggs"), allowed("log two eggs"));
});

Deno.test(
  "the training reads of the real registry land in the read set with no change here",
  () => {
    const registered = toolRegistry.list.map((tool) => ({
      name: tool.name,
      readOnlyHint: tool.annotations.readOnlyHint,
    }));
    const readSet = allowedToolsFor({
      text: "what's in my push day?",
      pendingConfirmationTool: null,
      tools: registered,
    });

    for (const name of ["search_exercises", "get_routines", "get_training_goals"]) {
      assert(readSet.includes(name), name);
    }
    assertEquals(readSet.includes("log_entry"), false);
  },
);

Deno.test("a training question gets the read set", () => {
  for (const text of [
    "What should I train today?",
    "Why has my bench stalled?",
    "Am I doing enough for my back?",
  ]) {
    assertEquals(allowed(text), ["search_foods", "get_food", "get_day", "ask_user"], text);
  }
});

Deno.test("a request to change training gets the general set", () => {
  for (const text of [
    "Swap bench for incline",
    "Make Push Pull Legs active",
    "Delete yesterday's workout",
  ]) {
    assert(allowed(text).includes("log_entry"), text);
  }
});

Deno.test("a question that holds a change word falls to the general set", () => {
  assert(allowed("Should I add more sets?").includes("log_entry"));
});
