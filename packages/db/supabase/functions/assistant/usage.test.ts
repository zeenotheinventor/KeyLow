import { assertEquals, assertRejects, assertThrows } from "@std/assert";

import { fakeSupabase } from "./testing.ts";
import { costUsdMicros, recordUsage } from "./usage.ts";

import type { UsageToRecord } from "./usage.ts";

const userId = "00000000-0000-4000-8000-0000000000a1";
const turnId = "00000000-0000-4000-8000-0000000000d3";
const model = "claude-haiku-5-5";
const none = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
};

// Haiku 5.5 is $0.10 / $0.50 per million tokens for a prompt of up to 100,000 tokens, cache reads at
// 0.1x the input rate and five-minute cache writes at 1.25x (Anthropic's published API pricing).
// One dollar per million tokens is one micro-dollar per token.
Deno.test("costUsdMicros prices each token kind from the Haiku 5.5 rates", () => {
  // 100,000 tokens is the largest prompt on the short rate card.
  const tokens = 100_000;

  assertEquals(costUsdMicros(model, { ...none, inputTokens: tokens }), 10_000);
  assertEquals(costUsdMicros(model, { ...none, outputTokens: tokens }), 50_000);
  assertEquals(costUsdMicros(model, { ...none, cacheReadInputTokens: tokens }), 1_000);
  assertEquals(costUsdMicros(model, { ...none, cacheCreationInputTokens: tokens }), 12_500);
});

Deno.test("costUsdMicros adds the kinds up: 12,000 in, 800 out, 30,000 read, 2,000 written", () => {
  // 1,200 + 400 + 300 + 250 micro-dollars.
  assertEquals(
    costUsdMicros(model, {
      inputTokens: 12_000,
      outputTokens: 800,
      cacheReadInputTokens: 30_000,
      cacheCreationInputTokens: 2_000,
    }),
    2_150,
  );
});

Deno.test("costUsdMicros rounds the total to a whole micro-dollar", () => {
  assertEquals(costUsdMicros(model, { ...none, inputTokens: 14 }), 1);
  assertEquals(costUsdMicros(model, { ...none, inputTokens: 16 }), 2);
  assertEquals(costUsdMicros(model, none), 0);
});

Deno.test("costUsdMicros uses the higher rates once the prompt passes 100,000 tokens", () => {
  // Input, cache reads and cache writes together are the prompt: $0.50 in, $2.50 out, reads at
  // $0.05 and writes at $0.625 per million.
  assertEquals(costUsdMicros(model, { ...none, inputTokens: 100_000 }), 10_000);
  assertEquals(costUsdMicros(model, { ...none, inputTokens: 100_001 }), 50_001);
  assertEquals(
    costUsdMicros(model, {
      inputTokens: 40_000,
      outputTokens: 1_000,
      cacheReadInputTokens: 60_000,
      cacheCreationInputTokens: 1_000,
    }),
    // 20,000 + 2,500 + 3,000 + 625
    26_125,
  );
});

Deno.test("costUsdMicros throws for a model it has no price for", () => {
  assertThrows(() => costUsdMicros("claude-unknown-9", none), Error, "claude-unknown-9");
});

const call: UsageToRecord = {
  userId,
  turnId,
  model,
  inputTokens: 12_000,
  outputTokens: 800,
  cacheReadInputTokens: 30_000,
  cacheCreationInputTokens: 2_000,
  latencyMilliseconds: 1_340,
  stopReason: "end_turn",
};

Deno.test(
  "recordUsage inserts one row of exactly the Amendment 14 columns and asks for nothing back",
  async () => {
    const { client, operations } = fakeSupabase();

    await recordUsage(client, call);

    assertEquals(operations.length, 1);
    assertEquals(operations[0]?.table, "assistant_usage");
    assertEquals(operations[0]?.chain, ["insert"]);
    assertEquals(operations[0]?.values, {
      user_id: userId,
      turn_id: turnId,
      route: "describe_or_ask",
      model,
      input_tokens: 12_000,
      output_tokens: 800,
      cache_read_input_tokens: 30_000,
      cache_creation_input_tokens: 2_000,
      cost_usd_micros: 2_150,
      latency_ms: 1_340,
      stop_reason: "end_turn",
      transport: "mcp_http",
    });
  },
);

Deno.test(
  "recordUsage writes a null stop reason when the call failed before one arrived",
  async () => {
    const { client, tables } = fakeSupabase();

    await recordUsage(client, { ...call, stopReason: null });

    assertEquals(tables["assistant_usage"]?.[0]?.["stop_reason"], null);
  },
);

Deno.test(
  "recordUsage fills no text column beyond route, model, stop reason and transport",
  async () => {
    const { client, operations } = fakeSupabase();

    await recordUsage(client, call);

    const values = operations[0]?.values;
    const textColumns = Object.entries(Array.isArray(values) ? {} : (values ?? {}))
      .filter(([name, value]) => typeof value === "string" && !name.endsWith("_id"))
      .map(([name]) => name);
    assertEquals(textColumns, ["route", "model", "stop_reason", "transport"]);
  },
);

Deno.test(
  "recordUsage throws the code of a failed insert, and an unknown model before inserting",
  async () => {
    const failing = fakeSupabase({
      failures: [{ table: "assistant_usage", kind: "insert", error: { code: "42501" } }],
    });
    const unknown = fakeSupabase();

    await assertRejects(() => recordUsage(failing.client, call), Error, "42501");
    await assertRejects(() => recordUsage(unknown.client, { ...call, model: "claude-unknown-9" }));

    assertEquals(unknown.operations, []);
  },
);

Deno.test("recordUsage writes route compact and transport none for a compaction call", async () => {
  const { client, operations } = fakeSupabase();

  await recordUsage(client, { ...call, route: "compact" });

  const values = operations[0]?.values;
  const row = Array.isArray(values) ? {} : values;
  assertEquals(row?.["route"], "compact");
  assertEquals(row?.["transport"], "none");
});
