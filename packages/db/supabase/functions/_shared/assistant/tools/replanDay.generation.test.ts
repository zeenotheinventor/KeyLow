// `replan_day` against the real generation service and a local stand-in for the Messages API, so the usage rows
// and the request that would be sent to Opus are the ones the service really makes. The live API is never called.
import { assertEquals, assertFalse } from "@std/assert";

import { executeTool } from "../executor.ts";
import { createGenerationServices } from "../generate.ts";
import { planMealsTool } from "./planMeals.ts";
import { planContext, scriptedGeneration } from "./planMealsFixtures.ts";
import { replanDayTool } from "./replanDay.ts";
import { payloadOf } from "./testing.ts";

import type { GenerationUsage } from "../generate.ts";

const planInput = {
  start_date: null,
  days: null,
  max_repeats: null,
  named_macros: [],
  request: null,
};

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

// A week made with a scripted ranking, so the only calls to the Messages API are the replan's own.
async function plannedWeek(generation: ReturnType<typeof servicesFor>["generation"]) {
  const made = planContext([planMealsTool, replanDayTool], {
    generation: scriptedGeneration([{ ranking: ["r1", "r2", "f1", "f2"] }]).generation,
  });
  await executeTool(made.ctx, "plan_meals", planInput);
  return { ...made, ctx: { ...made.ctx, generation } };
}

const replanInput = { local_date: "2026-11-18", request: null as string | null };

Deno.test(
  "a replan with new words makes one Opus call and one plan_generate usage row",
  async () => {
    await withMessagesApi(
      { body: message(JSON.stringify({ ranking: ["f1", "f2"] })) },
      async ({ baseUrl, bodies }) => {
        const { generation, usage } = servicesFor(baseUrl);
        const { ctx } = await plannedWeek(generation);

        const result = await executeTool(ctx, "replan_day", { ...replanInput, request: "no meat" });

        assertEquals(result.status, "ok");
        assertEquals(bodies.length, 1);
        assertEquals(usage.length, 1);
        assertEquals(usage[0]?.route, "plan_generate");
        assertFalse("tools" in (bodies[0] ?? {}));
      },
    );
  },
);

Deno.test(
  "a replan with no new words reuses the stored ranking: no Opus call and no usage row",
  async () => {
    await withMessagesApi({ body: message("{}") }, async ({ baseUrl, bodies }) => {
      const { generation, usage } = servicesFor(baseUrl);
      const { ctx } = await plannedWeek(generation);

      const result = await executeTool(ctx, "replan_day", replanInput);

      assertEquals(result.status, "ok");
      assertEquals(bodies.length, 0);
      assertEquals(usage.length, 0);
    });
  },
);

Deno.test("a refused ranking changes nothing and is still counted once", async () => {
  await withMessagesApi({ body: message("", "refusal") }, async ({ baseUrl }) => {
    const { generation, usage } = servicesFor(baseUrl);
    const { ctx, stub } = await plannedWeek(generation);
    const before = JSON.stringify(stub.tables["meal_plans"]);

    const result = await executeTool(ctx, "replan_day", { ...replanInput, request: "no meat" });

    assertEquals((payloadOf(result) as { reason: string }).reason, "generation_refused");
    assertEquals(JSON.stringify(stub.tables["meal_plans"]), before);
    assertEquals(usage.length, 1);
  });
});

Deno.test("an API error changes nothing and says so", async () => {
  await withMessagesApi(
    { status: 529, body: { type: "error", error: { type: "overloaded_error" } } },
    async ({ baseUrl }) => {
      const { generation } = servicesFor(baseUrl);
      const { ctx, stub } = await plannedWeek(generation);
      const before = JSON.stringify(stub.tables["meal_plans"]);

      const result = await executeTool(ctx, "replan_day", { ...replanInput, request: "no meat" });

      assertEquals((payloadOf(result) as { reason: string }).reason, "generation_failed");
      assertEquals(JSON.stringify(stub.tables["meal_plans"]), before);
    },
  );
});
