import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { executeTool } from "../executor.ts";
import { toolRegistry } from "../registry.ts";
import { createFakeContext } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { askUserTool } from "./askUser.ts";
import { payloadOf } from "./testing.ts";

const ask = (rawInput: unknown) => {
  const { ctx } = createFakeContext([askUserTool]);
  return executeTool(ctx, "ask_user", rawInput);
};

Deno.test("ask_user is a read tool that says it is read-only, and the registry lists it", () => {
  assertEquals(askUserTool.kind, "read");
  assertEquals(askUserTool.annotations, { readOnlyHint: true });
  assertEquals(toolRegistry.get("ask_user"), askUserTool);
});

Deno.test("ask_user is listed after the tools that were there before it", () => {
  assertEquals(toolRegistry.list.at(-1)?.name, "ask_user");
});

Deno.test(
  "the strict JSON Schema of ask_user renders closed, with both properties required",
  () => {
    const schema = toJsonSchema(askUserTool);

    assertEquals(schema["type"], "object");
    assertEquals(schema["additionalProperties"], false);
    assertEquals(schema["required"], ["question", "quick_replies"]);
    const properties = schema["properties"];
    assert(typeof properties === "object" && properties !== null);
    assertEquals(Object.keys(properties), ["question", "quick_replies"]);
  },
);

Deno.test(
  "ask_user has no optional or union parameter, so it adds nothing to the strict caps",
  () => {
    assertEquals(JSON.stringify(toJsonSchema(askUserTool)).includes("anyOf"), false);
  },
);

Deno.test("ask_user tells the model quick replies are the food's own portions or grams", () => {
  assertStringIncludes(askUserTool.description, "portions");
  assertStringIncludes(askUserTool.description, "grams");
  assertStringIncludes(askUserTool.description, "1 chicken breast");
  assertStringIncludes(askUserTool.description, "150 g rice");
  assertStringIncludes(askUserTool.description, "never a hand measure");
});

Deno.test("ask_user answers a fixed result and touches no database", async () => {
  const result = await ask({ question: "How much rice?", quick_replies: ["100 g", "150 g"] });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { status: "asked" });
});

Deno.test("ask_user takes no quick replies at all", async () => {
  assertEquals((await ask({ question: "Which day?", quick_replies: [] })).status, "ok");
});

Deno.test("a fourth quick reply fails the executor's validation", async () => {
  const result = await ask({
    question: "How much?",
    quick_replies: ["1 egg", "2 eggs", "3 eggs", "4 eggs"],
  });

  assertEquals(result.status, "error");
  assertEquals(result.status === "error" ? result.code : null, "invalid_input");
});

Deno.test("an empty question or an empty quick reply fails validation", async () => {
  assertEquals((await ask({ question: "", quick_replies: [] })).status, "error");
  assertEquals((await ask({ question: "How much?", quick_replies: [""] })).status, "error");
});

Deno.test(
  "a missing quick_replies list fails validation, because a strict tool has no optional input",
  async () => {
    assertEquals((await ask({ question: "How much?" })).status, "error");
  },
);
