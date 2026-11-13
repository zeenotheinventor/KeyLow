// `plan_meals` against the real generation service and a local stand-in for the Messages API, so the usage rows
// and the request that would be sent to Opus are the ones the service really makes. The live API is never called.
import { assert, assertEquals, assertFalse } from "@std/assert";

import { executeTool } from "../executor.ts";
import { createGenerationServices } from "../generate.ts";
import { planMealsTool } from "./planMeals.ts";
import { planContext } from "./planMealsFixtures.ts";
import { payloadOf } from "./testing.ts";

import type { GenerationUsage } from "../generate.ts";

const input = { start_date: null, days: null, max_repeats: null, named_macros: [], request: null };

type Reply = { status?: number; body?: unknown };

async function withMessagesApi<T>(
  reply: Reply,
  run: (setup: { baseUrl: string; bodies: Record<string, unknown>[] }) => Promise<T>,
): Promise<T> {
  const bodies: Record<string, unknown>[] = [];
  const listening = Promise.withResolvers<number>();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    async (request) => {
      bodies.push(JSON.parse(await request.text()));
      return Response.json(reply.body, { status: reply.status ?? 200 });
    },
  );
  try {
    return await run({ baseUrl: `http://127.0.0.1:${await listening.promise}`, bodies });
  } finally {
    await server.shutdown();
  }
}

const message = (text: string, stopReason = "end_turn") => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: {
    input_tokens: 900,
    output_tokens: 300,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
});

function servicesFor(baseUrl: string) {
  const usage: GenerationUsage[] = [];
  const reported: unknown[] = [];
  const generation = createGenerationServices({
    readEnv: (name) => ({ ANTHROPIC_API_KEY: "key-for-tests", ANTHROPIC_BASE_URL: baseUrl })[name],
    recordUsage: (call) => {
      usage.push(call);
      return Promise.resolve();
    },
    report: (_function, _code, caught) => reported.push(caught),
    hasPrice: (model) => model === "claude-opus-5-5",
  });
  return { generation, usage, reported };
}

Deno.test("a plan makes one Opus call and writes exactly one plan_generate usage row", async () => {
  await withMessagesApi(
    { body: message(JSON.stringify({ ranking: ["r2", "r1", "f1"] })) },
    async ({ baseUrl, bodies }) => {
      const { generation, usage } = servicesFor(baseUrl);
      const { ctx, saved } = planContext(planMealsTool, { generation });

      const result = await executeTool(ctx, "plan_meals", input);

      assertEquals(result.status, "ok");
      assertEquals(saved.length, 1);
      assertEquals(bodies.length, 1);
      assertEquals(usage.length, 1);
      assertEquals(usage[0]?.route, "plan_generate");
      assertEquals(usage[0]?.model, "claude-opus-5-5");
      assertFalse("tools" in (bodies[0] ?? {}));
    },
  );
});

Deno.test(
  "a refused plan is reported as refused, saves nothing and is still counted once",
  async () => {
    await withMessagesApi({ body: message("", "refusal") }, async ({ baseUrl }) => {
      const { generation, usage } = servicesFor(baseUrl);
      const { ctx, saved } = planContext(planMealsTool, { generation });

      const result = await executeTool(ctx, "plan_meals", input);

      assertEquals((payloadOf(result) as { reason: string }).reason, "generation_refused");
      assertEquals(saved.length, 0);
      assertEquals(usage.length, 1);
    });
  },
);

Deno.test("an unreachable Messages API saves nothing and says so", async () => {
  // A port that nothing listens on: the server is started to find a free port and stopped again.
  const listening = Promise.withResolvers<number>();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    () => new Response(null),
  );
  const port = await listening.promise;
  await server.shutdown();
  const { generation, usage } = servicesFor(`http://127.0.0.1:${port}`);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  const result = await executeTool(ctx, "plan_meals", input);

  assertEquals((payloadOf(result) as { reason: string }).reason, "generation_failed");
  assertEquals(saved.length, 0);
  assert(usage.length <= 1);
});

Deno.test("an API error saves nothing and says so", async () => {
  await withMessagesApi(
    { status: 529, body: { type: "error", error: { type: "overloaded_error" } } },
    async ({ baseUrl }) => {
      const { generation } = servicesFor(baseUrl);
      const { ctx, saved } = planContext(planMealsTool, { generation });

      const result = await executeTool(ctx, "plan_meals", input);

      assertEquals((payloadOf(result) as { reason: string }).reason, "generation_failed");
      assertEquals(saved.length, 0);
    },
  );
});
