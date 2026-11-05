import { assertEquals } from "@std/assert";

import { userMessageOf } from "./turns.ts";

const text = (value: string) => ({ type: "text", text: value });
const toolResult = (value: string) => ({
  type: "tool_result",
  tool_use_id: "toolu_1",
  content: [text(value)],
});
const context = text("Today is Tue 3 Nov (2026-11-03) in Europe/London.");

Deno.test(
  "the person's words are the last block, and never a tool result or the context block",
  () => {
    const message = userMessageOf([
      toolResult("Delete 2 entries"),
      context,
      text("Show me what I logged"),
    ]);

    assertEquals(message.personsWords, "Show me what I logged");
  },
);

Deno.test("the button's words are the person's words when they are the last block", () => {
  const message = userMessageOf([toolResult("something"), context, text("Delete 2 entries")]);

  assertEquals(message.personsWords, "Delete 2 entries");
});

Deno.test(
  "the text is every text block of the message, as the empty-message guard reads it",
  () => {
    const message = userMessageOf([context, text("Delete 2 entries")]);

    assertEquals(
      message.text,
      "Today is Tue 3 Nov (2026-11-03) in Europe/London.\nDelete 2 entries",
    );
  },
);

Deno.test("a message whose last block is not text has no words of the person", () => {
  assertEquals(userMessageOf([context, toolResult("Delete 2 entries")]).personsWords, null);
  assertEquals(userMessageOf([context, { type: "image" }]).personsWords, null);
});

Deno.test("a blank last block, an empty message and content that is not blocks have none", () => {
  assertEquals(userMessageOf([context, text("   ")]).personsWords, null);
  assertEquals(userMessageOf([]), { text: null, personsWords: null });
  assertEquals(userMessageOf(null), { text: null, personsWords: null });
  assertEquals(userMessageOf("Delete 2 entries"), { text: null, personsWords: null });
  assertEquals(userMessageOf([{ type: "text" }]).personsWords, null);
});
