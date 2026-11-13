// A live check of the hidden kitchen group (ADR 0006, Amendment 5), run by hand and never by the tests. It builds the
// same request the turn loop builds (`buildTurnRequest`, the replay and the stored addition) and sends a
// two-turn kitchen conversation straight to the Messages API, so it answers two questions without a stack:
//
// - does the API take the beta, a deferred tool and a `tool_addition` on Haiku 5.5, and
// - does the second kitchen turn read the visible prefix from the prompt cache.
//
// It prints counts only, never a prompt or a message. Run it from packages/db with a key in the environment:
//
//   ANTHROPIC_API_KEY=... pnpm exec deno run --config supabase/functions/deno.json --allow-env \
//     --allow-net=api.anthropic.com supabase/functions/assistant/kitchenCacheProbe.ts
//
// ANTHROPIC_BASE_URL is honoured, for a mock. Each run writes the cache for a few minutes, so a second run in
// that time reads it from the first call on.
import { toAnthropicTools } from "../_shared/assistant/adapters/anthropic.ts";
import { createToolRegistry } from "../_shared/assistant/registry.ts";
import { toJsonSchema } from "../_shared/assistant/tool.ts";
import { KITCHEN_BETA, kitchenAdditionContent } from "./kitchen.ts";
import {
  SYSTEM_PROMPT,
  buildTurnRequest,
  contextBlock,
  toApiMessagesWithNote,
  userContent,
} from "./prompt.ts";
import { createModelClient } from "./turn.ts";

import type Anthropic from "@anthropic-ai/sdk";
import type { ListedTool } from "../_shared/assistant/mcpClient.ts";
import type { StoredHistoryMessage } from "./prompt.ts";

// The estimate `promptPrefix.test.ts` uses, so the figure to compare with is the one the repository states.
const PREFIX_CHARACTERS_PER_TOKEN = 2.94;

type CallFigures = { label: string; input: number; read: number; written: number };

const maybeClient = createModelClient((name) => Deno.env.get(name));
if (maybeClient === null) {
  console.error("Set ANTHROPIC_API_KEY.");
  Deno.exit(1);
}
const client: Anthropic = maybeClient;

const listedTools: ListedTool[] = createToolRegistry({ kitchenProbe: true }).list.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: toJsonSchema(tool),
  readOnlyHint: tool.annotations.readOnlyHint,
  strict: tool.strict !== false,
  ...(tool.group === undefined ? {} : { group: tool.group }),
}));
const tools = toAnthropicTools(listedTools);
const visibleToolCharacters = JSON.stringify(
  toAnthropicTools(listedTools.filter((tool) => tool.group === undefined)),
).length;
const visiblePrefixEstimate = Math.ceil(
  (SYSTEM_PROMPT.length + visibleToolCharacters) / PREFIX_CHARACTERS_PER_TOKEN,
);

const history: StoredHistoryMessage[] = [];
const figures: CallFigures[] = [];
let rowCount = 0;

function store(role: StoredHistoryMessage["role"], content: unknown, turnId: string): void {
  rowCount += 1;
  history.push({ id: `row-${rowCount}`, turnId, role, content, display: null });
}

const toJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

async function call(label: string, turnId: string): Promise<Anthropic.Message> {
  const request = buildTurnRequest({
    tools,
    messages: toApiMessagesWithNote(history, null, turnId),
  });
  const message = await client.messages
    .stream(request, { headers: { "anthropic-beta": KITCHEN_BETA } })
    .finalMessage();
  figures.push({
    label,
    input: message.usage.input_tokens,
    read: message.usage.cache_read_input_tokens ?? 0,
    written: message.usage.cache_creation_input_tokens ?? 0,
  });
  return message;
}

// One turn: the person's words, the addition on the first kitchen turn, and the model calls until it stops.
async function runTurn(turnId: string, text: string, addition: boolean): Promise<void> {
  const context = contextBlock({
    now: new Date().toISOString(),
    timeZone: "Europe/London",
    localDate: new Date().toISOString().slice(0, 10),
    localTime: null,
  });
  store("user", toJson(userContent({ openToolUses: [], context, text })), turnId);
  if (addition) {
    store(
      "system",
      kitchenAdditionContent(
        listedTools.flatMap((tool) => (tool.group === "kitchen" ? [tool.name] : [])),
      ),
      turnId,
    );
  }
  for (let step = 1; step <= 4; step++) {
    const message = await call(`${turnId} call ${step}`, turnId);
    store("assistant", toJson(message.content), turnId);
    const toolUses = message.content.flatMap((block) => (block.type === "tool_use" ? [block] : []));
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      return;
    }
    store(
      "user",
      toolUses.map((toolUse) => ({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: '<untrusted_data tool="kitchen_probe">{"status":"ok"}</untrusted_data>',
      })),
      turnId,
    );
  }
}

await runTurn("turn 1", "Please call the kitchen_probe tool once, then say done.", true);
await runTurn("turn 2", "Thanks. Call kitchen_probe once more, then say done.", false);

console.log(`visible prefix estimate: ${visiblePrefixEstimate} tokens`);
for (const row of figures) {
  console.log(
    `${row.label}: input ${row.input}, cache_read ${row.read}, cache_creation ${row.written}`,
  );
}
const secondTurnFirstCall = figures.find((row) => row.label === "turn 2 call 1");
console.log(
  secondTurnFirstCall !== undefined && secondTurnFirstCall.read >= visiblePrefixEstimate
    ? "second kitchen turn read at least the visible prefix estimate from the cache"
    : "second kitchen turn read less than the visible prefix estimate (the estimate errs a little high, so compare with the first call's total)",
);
