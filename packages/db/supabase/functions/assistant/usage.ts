// The usage row of one model call, and what that call cost. `service_role` has insert only on
// `assistant_usage` (ADR 0003, Amendment 14), so the row is written without asking for it back.
// The month's spend is read through `assistant_spend_this_month()` and never from this table.
import type { Database } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
};

// `describe_or_ask` is a call of the turn loop, which reaches its tools over MCP. `compact` is the call that
// writes a conversation's note, which has no tools and no transport (the table's own check lists both).
export type UsageRoute = "describe_or_ask" | "compact";

export type UsageToRecord = TokenCounts & {
  userId: string;
  turnId: string;
  // Left out for a call of the turn loop.
  route?: UsageRoute;
  model: string;
  latencyMilliseconds: number;
  // The API's stop reason, null when the call failed before one arrived.
  stopReason: string | null;
};

// Micro-dollars per million tokens, which is the dollar price per million tokens times 1,000,000.
type Rates = { input: number; output: number; cacheRead: number; cacheWrite: number };

// Anthropic's published API pricing for Claude Haiku 5.5: $0.10 per million input tokens and $0.50 per
// million output tokens for a prompt of 100,000 tokens or fewer, and $0.50 and $2.50 above that. Cache
// reads cost 0.1x the input rate and five-minute cache writes 1.25x. The one-hour write rate is not
// used, because the loop asks for the default five-minute cache.
const haikuUpTo100kPrompt: Rates = {
  input: 100_000,
  output: 500_000,
  cacheRead: 10_000,
  cacheWrite: 125_000,
};
const haikuOver100kPrompt: Rates = {
  input: 500_000,
  output: 2_500_000,
  cacheRead: 50_000,
  cacheWrite: 625_000,
};
const longPromptTokens = 100_000;

const pricesByModel: Record<string, { short: Rates; long: Rates }> = {
  "claude-haiku-5-5": { short: haikuUpTo100kPrompt, long: haikuOver100kPrompt },
};

// Whole micro-dollars, rounded once on the total. An unknown model throws, so a model change cannot
// quietly record a spend of zero against the monthly cap.
export function costUsdMicros(model: string, counts: TokenCounts): number {
  const prices = pricesByModel[model];
  if (prices === undefined) {
    throw new Error(`assistant usage has no price for ${model}`);
  }
  const promptTokens =
    counts.inputTokens + counts.cacheReadInputTokens + counts.cacheCreationInputTokens;
  const rates = promptTokens > longPromptTokens ? prices.long : prices.short;
  const scaledMicroDollars =
    counts.inputTokens * rates.input +
    counts.outputTokens * rates.output +
    counts.cacheReadInputTokens * rates.cacheRead +
    counts.cacheCreationInputTokens * rates.cacheWrite;
  return Math.round(scaledMicroDollars / 1_000_000);
}

export async function recordUsage(
  client: SupabaseClient<Database>,
  call: UsageToRecord,
): Promise<void> {
  // Priced first, so an unknown model throws before anything is sent.
  const costMicros = costUsdMicros(call.model, call);
  const route = call.route ?? "describe_or_ask";
  const { error } = await client.from("assistant_usage").insert({
    user_id: call.userId,
    turn_id: call.turnId,
    route,
    model: call.model,
    input_tokens: call.inputTokens,
    output_tokens: call.outputTokens,
    cache_read_input_tokens: call.cacheReadInputTokens,
    cache_creation_input_tokens: call.cacheCreationInputTokens,
    cost_usd_micros: costMicros,
    latency_ms: call.latencyMilliseconds,
    stop_reason: call.stopReason,
    transport: route === "compact" ? "none" : "mcp_http",
  });
  if (error !== null) {
    throw new Error(`assistant usage insert failed ${error.code}`);
  }
}
