import { assert, assertEquals } from "@std/assert";

import { toAnthropicTools } from "../_shared/assistant/adapters/anthropic.ts";
import { createToolRegistry, toolRegistry } from "../_shared/assistant/registry.ts";
import { toJsonSchema } from "../_shared/assistant/tool.ts";
import { DEFAULT_COMPACT_AT_TOKENS } from "./compact.ts";
import { kitchenAdditionContent } from "./kitchen.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";

import type { ListedTool } from "../_shared/assistant/mcpClient.ts";
import type { ToolRegistry } from "../_shared/assistant/tool.ts";

// KEY-927. The compaction threshold counts the whole prompt of a turn's last model call, and the tools and the
// system prompt are most of it before the first word of the conversation. When the registry grew past the old
// threshold, every turn compacted. This fails when a new tool or a longer prompt would leave the conversation
// less than 40 % of the threshold, so the choice (trim the new tool, or raise the threshold on purpose) is
// made in the pull request that grows the prefix.
const LARGEST_SHARE_OF_THRESHOLD = 0.6;

// Calibrated on the figures the ticket gave (KEY-927): 21,666 prompt tokens for 11,313 + 52,432 characters,
// which is 2.94 characters a token. The ticket did not say how the characters were counted, and this test
// counts 9,554 + 57,777 (system prompt plus the tools as sent) on the same tree, so the ratio is a rough one.
// A later real first call measured 22,396 prompt tokens for a one-turn conversation, against the 22,901 this
// test estimates for the prefix alone, so it errs a little high. Tool schemas are JSON, which tokenises worse
// than prose (about 4 characters a token), so the ratio is only good for the prefix. Recalibrate it when a
// real first call disagrees.
const PREFIX_CHARACTERS_PER_TOKEN = 2.94;

const listedToolsOf = (registry: ToolRegistry): ListedTool[] =>
  registry.list.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchema(tool),
    readOnlyHint: tool.annotations.readOnlyHint,
    strict: tool.strict !== false,
    ...(tool.group === undefined ? {} : { group: tool.group }),
  }));

const estimatedTokens = (characters: number): number =>
  Math.ceil(characters / PREFIX_CHARACTERS_PER_TOKEN);

// ADR 0006, Amendment 5. A tool of the kitchen group is in `tools[]` with `defer_loading` and is not in the
// model's context until a turn surfaces it, so the prefix of an ordinary turn counts the visible tools only.
const visibleToolsAsSent = (tools: readonly ListedTool[]) =>
  toAnthropicTools(tools.filter((tool) => tool.group === undefined));

const prefixTokensOf = (tools: readonly ListedTool[]): number =>
  estimatedTokens(SYSTEM_PROMPT.length + JSON.stringify(visibleToolsAsSent(tools)).length);

// What a kitchen turn adds: the deferred tools as sent, and the stored system message that surfaces them.
const kitchenAdditionTokensOf = (tools: readonly ListedTool[]): number => {
  const kitchenTools = tools.filter((tool) => tool.group === "kitchen");
  return estimatedTokens(
    JSON.stringify(toAnthropicTools(kitchenTools)).length +
      JSON.stringify(kitchenAdditionContent(kitchenTools.map((tool) => tool.name))).length,
  );
};

// What a kitchen turn may add to the prefix, deferred tool definitions and the system message together. The
// conversation's room is 40 % of the compaction threshold, so this is a fixed 2,500 tokens of it (KEY-1022).
const KITCHEN_ADDITION_LIMIT_TOKENS = 2_500;

Deno.test(
  "the tools and the system prompt leave most of the compaction threshold to the conversation",
  () => {
    const tokens = prefixTokensOf(listedToolsOf(toolRegistry));
    const limit = Math.floor(DEFAULT_COMPACT_AT_TOKENS * LARGEST_SHARE_OF_THRESHOLD);

    assert(
      tokens <= limit,
      `The tools and the system prompt are about ${tokens} tokens, over ${limit}, which is ${LARGEST_SHARE_OF_THRESHOLD * 100} % of the ${DEFAULT_COMPACT_AT_TOKENS} token compaction threshold. A conversation would have too little room before it compacts. Shorten the new tool or prompt text, or raise DEFAULT_COMPACT_AT_TOKENS in compact.ts and say so in ADR 0006.`,
    );
  },
);

const heavyKitchenTool = (characters: number): ListedTool => ({
  name: "heavy_kitchen_tool",
  description: "x".repeat(characters),
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  readOnlyHint: true,
  strict: false,
  group: "kitchen",
});

Deno.test("a kitchen tool does not count towards the prefix of an ordinary turn", () => {
  const visible = listedToolsOf(toolRegistry);

  assertEquals(prefixTokensOf([...visible, heavyKitchenTool(60_000)]), prefixTokensOf(visible));
});

Deno.test("the kitchen addition stays within 2,500 tokens, the kitchen probe included", () => {
  const tokens = kitchenAdditionTokensOf(listedToolsOf(createToolRegistry({ kitchenProbe: true })));

  assert(
    tokens <= KITCHEN_ADDITION_LIMIT_TOKENS,
    `The kitchen tools and their system message are about ${tokens} tokens, over ${KITCHEN_ADDITION_LIMIT_TOKENS}. Shorten the tool text or move the rules into the Opus call's own prompt.`,
  );
});

Deno.test("a kitchen group that is too big for its limit is measured as over it", () => {
  const tokens = kitchenAdditionTokensOf([heavyKitchenTool(20_000)]);

  assert(tokens > KITCHEN_ADDITION_LIMIT_TOKENS);
});

Deno.test("the limit of the kitchen addition is 2,500 tokens", () => {
  assertEquals(KITCHEN_ADDITION_LIMIT_TOKENS, 2_500);
});
