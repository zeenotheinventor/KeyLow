import { assert } from "@std/assert";

import { toAnthropicTools } from "../_shared/assistant/adapters/anthropic.ts";
import { toolRegistry } from "../_shared/assistant/registry.ts";
import { toJsonSchema } from "../_shared/assistant/tool.ts";
import { DEFAULT_COMPACT_AT_TOKENS } from "./compact.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";

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

const toolsAsSent = toAnthropicTools(
  toolRegistry.list.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchema(tool),
    readOnlyHint: tool.annotations.readOnlyHint,
    strict: tool.strict !== false,
  })),
);

Deno.test(
  "the tools and the system prompt leave most of the compaction threshold to the conversation",
  () => {
    const prefixCharacters = SYSTEM_PROMPT.length + JSON.stringify(toolsAsSent).length;
    const estimatedTokens = Math.ceil(prefixCharacters / PREFIX_CHARACTERS_PER_TOKEN);
    const limit = Math.floor(DEFAULT_COMPACT_AT_TOKENS * LARGEST_SHARE_OF_THRESHOLD);

    assert(
      estimatedTokens <= limit,
      `The tools and the system prompt are about ${estimatedTokens} tokens, over ${limit}, which is ${LARGEST_SHARE_OF_THRESHOLD * 100} % of the ${DEFAULT_COMPACT_AT_TOKENS} token compaction threshold. A conversation would have too little room before it compacts. Shorten the new tool or prompt text, or raise DEFAULT_COMPACT_AT_TOKENS in compact.ts and say so in ADR 0006.`,
    );
  },
);
