import { assert, assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import { readSubstitution, recipeSuggestionSchema, substitutionSchema } from "../core.ts";
import {
  createGenerationServices,
  GENERATION_MAX_TOKENS,
  GENERATION_MODEL,
  GENERATION_TIMEOUT_MILLISECONDS,
} from "./generate.ts";

import type { GenerationUsage } from "./generate.ts";

// A Messages API that answers each request with the next scripted reply and keeps what it was sent.
type Reply = { status?: number; body?: unknown; hang?: boolean };

async function startMessagesApi(replies: Reply[]) {
  const bodies: Record<string, unknown>[] = [];
  const headers: Headers[] = [];
  const listening = Promise.withResolvers<number>();
  const stopped = Promise.withResolvers<void>();
  let next = 0;
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    async (request) => {
      bodies.push(JSON.parse(await request.text()));
      headers.push(request.headers);
      const reply = replies[next++] ?? { status: 400 };
      if (reply.hang === true) {
        await stopped.promise;
        return new Response(null, { status: 499 });
      }
      return Response.json(reply.body ?? { type: "error", error: { type: "api_error" } }, {
        status: reply.status ?? 200,
      });
    },
  );
  return {
    baseUrl: `http://127.0.0.1:${await listening.promise}`,
    bodies,
    headers,
    async shutdown() {
      stopped.resolve();
      await server.shutdown();
    },
  };
}

const message = (text: string, overrides: Record<string, unknown> = {}) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 4_000,
    output_tokens: 1_700,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
  ...overrides,
});

const suggestion = {
  name: "Lemon chicken traybake",
  servings: 2,
  ingredients: [{ name: "chicken thigh", grams: 300 }],
  steps: ["Roast it."],
};

const userId = "00000000-0000-4000-8000-0000000000a1";
const turnId = "00000000-0000-4000-8000-0000000000d3";
const pricedModels = ["claude-opus-5-5", "claude-haiku-5-5"];
const sentinel = "personal-sentinel-words";

async function withServices<T>(
  replies: Reply[],
  run: (setup: {
    services: ReturnType<typeof createGenerationServices>;
    api: Awaited<ReturnType<typeof startMessagesApi>>;
    usage: GenerationUsage[];
    reported: unknown[];
  }) => Promise<T>,
  env: Record<string, string> = {},
): Promise<T> {
  const api = await startMessagesApi(replies);
  const usage: GenerationUsage[] = [];
  const reported: unknown[] = [];
  const environment: Record<string, string> = {
    ANTHROPIC_API_KEY: "key-sentinel-1",
    ANTHROPIC_BASE_URL: api.baseUrl,
    ...env,
  };
  const services = createGenerationServices({
    readEnv: (name) => environment[name],
    recordUsage: (call) => {
      usage.push(call);
      return Promise.resolve();
    },
    report: (_function, _code, caught) => reported.push(caught),
    hasPrice: (model) => pricedModels.includes(model),
  });
  try {
    return await run({ services, api, usage, reported });
  } finally {
    await api.shutdown();
  }
}

const suggestionRequest = {
  route: "recipe_generate" as const,
  userId,
  turnId,
  system: "You propose a recipe.",
  userContent: `<untrusted_data>${sentinel}</untrusted_data>`,
  format: recipeSuggestionSchema,
  read: (reply: unknown) => {
    const read = recipeSuggestionSchema.safeParse(reply);
    return read.success ? read.data : null;
  },
};

Deno.test("the limits are the ones the ADR states", () => {
  assertEquals(GENERATION_MODEL, "claude-opus-5-5");
  assertEquals(GENERATION_MAX_TOKENS, 3_000);
  assertEquals(GENERATION_TIMEOUT_MILLISECONDS, 40_000);
});

Deno.test("the request is tool-less Opus 5.5 at effort low, with refusal fallbacks", async () => {
  await withServices([{ body: message(JSON.stringify(suggestion)) }], async ({ services, api }) => {
    await services.generate(suggestionRequest);

    const body = api.bodies[0];
    assertEquals(body?.["model"], "claude-opus-5-5");
    assertEquals(body?.["max_tokens"], 3_000);
    assertEquals(body?.["fallbacks"], "default");
    assertEquals(body?.["system"], "You propose a recipe.");
    const outputConfig = body?.["output_config"] as Record<string, unknown>;
    assertEquals(outputConfig["effort"], "low");
    assertEquals((outputConfig["format"] as Record<string, unknown>)["type"], "json_schema");
    for (const key of [
      "tools",
      "tool_choice",
      "temperature",
      "top_p",
      "top_k",
      "thinking",
      "inference_geo",
      "output_format",
      "stream",
    ]) {
      assertFalse(key in (body ?? {}), key);
    }
    assertStringIncludes(
      api.headers[0]?.get("anthropic-beta") ?? "",
      "server-side-fallback-2026-07-01",
    );
    assertEquals(body?.["messages"], [{ role: "user", content: suggestionRequest.userContent }]);
  });
});

Deno.test(
  "the output format is the schema of the reader, without bounds the API cannot take",
  async () => {
    await withServices(
      [{ body: message(JSON.stringify(suggestion)) }],
      async ({ services, api }) => {
        await services.generate(suggestionRequest);

        const outputConfig = api.bodies[0]?.["output_config"] as Record<string, unknown>;
        const schema = JSON.stringify(outputConfig["format"]);
        for (const field of ["name", "servings", "ingredients", "grams", "steps"]) {
          assertStringIncludes(schema, `"${field}"`);
        }
        assertStringIncludes(schema, '"additionalProperties":false');
        assertFalse(schema.includes('"maxLength"'));
        assertFalse(schema.includes('"maxItems"'));
      },
    );
  },
);

Deno.test(
  "a good answer is returned as the reader's value with the model that answered",
  async () => {
    await withServices([{ body: message(JSON.stringify(suggestion)) }], async ({ services }) => {
      const outcome = await services.generate(suggestionRequest);

      assertEquals(outcome, { ok: true, value: suggestion, model: "claude-opus-5-5" });
    });
  },
);

Deno.test("one usage row is written for the call, priced at the Opus 5.5 rates", async () => {
  await withServices(
    [{ body: message(JSON.stringify(suggestion)) }],
    async ({ services, usage }) => {
      await services.generate(suggestionRequest);

      assertEquals(usage.length, 1);
      const row = usage[0];
      assertEquals(row?.userId, userId);
      assertEquals(row?.turnId, turnId);
      assertEquals(row?.route, "recipe_generate");
      assertEquals(row?.model, "claude-opus-5-5");
      assertEquals(row?.inputTokens, 4_000);
      assertEquals(row?.outputTokens, 1_700);
      assertEquals(row?.stopReason, "end_turn");
      assert((row?.latencyMilliseconds ?? -1) >= 0);
    },
  );
});

Deno.test("a plan call writes its own route", async () => {
  await withServices(
    [{ body: message(JSON.stringify(suggestion)) }],
    async ({ services, usage }) => {
      await services.generate({ ...suggestionRequest, route: "plan_generate" });

      assertEquals(usage[0]?.route, "plan_generate");
    },
  );
});

Deno.test("a final refusal is generation_refused, and the call is still counted", async () => {
  const refusal = message("", {
    content: [],
    stop_reason: "refusal",
    stop_details: { type: "refusal", category: null, explanation: sentinel },
  });
  await withServices([{ body: refusal }], async ({ services, usage, reported }) => {
    const outcome = await services.generate(suggestionRequest);

    assertEquals(outcome, { ok: false, code: "generation_refused" });
    assertEquals(usage.length, 1);
    assertEquals(usage[0]?.stopReason, "refusal");
    assertFalse(JSON.stringify(reported).includes(sentinel));
  });
});

Deno.test(
  "a refusal that a fallback model served is an answer, recorded under that model",
  async () => {
    const served = message(JSON.stringify(suggestion), { model: "claude-haiku-5-5" });
    await withServices([{ body: served }], async ({ services, usage }) => {
      const outcome = await services.generate(suggestionRequest);

      assertEquals(outcome, { ok: true, value: suggestion, model: "claude-haiku-5-5" });
      assertEquals(usage[0]?.model, "claude-haiku-5-5");
    });
  },
);

Deno.test(
  "a fallback model with no price is recorded at the Opus 5.5 rates, never dropped",
  async () => {
    const served = message(JSON.stringify(suggestion), { model: "claude-future-9" });
    await withServices([{ body: served }], async ({ services, usage }) => {
      const outcome = await services.generate(suggestionRequest);

      assertEquals(outcome, { ok: true, value: suggestion, model: "claude-future-9" });
      assertEquals(usage[0]?.model, "claude-opus-5-5");
    });
  },
);

Deno.test(
  "a call that outlasts the timeout is generation_timeout, and the call is still counted",
  async () => {
    await withServices([{ hang: true }], async ({ services, usage, reported }) => {
      const outcome = await services.generate({ ...suggestionRequest, timeoutMilliseconds: 50 });

      assertEquals(outcome, { ok: false, code: "generation_timeout" });
      assertEquals(usage.length, 1);
      assertEquals(usage[0]?.inputTokens, 0);
      assertEquals(usage[0]?.stopReason, null);
      assertEquals(usage[0]?.model, "claude-opus-5-5");
      assertEquals(reported.length, 1);
    });
  },
);

Deno.test("an API error is generation_failed, is not retried, and quotes no content", async () => {
  await withServices(
    [
      { status: 529, body: { type: "error", error: { type: "overloaded_error" } } },
      { body: message("{}") },
    ],
    async ({ services, api, usage, reported }) => {
      const outcome = await services.generate(suggestionRequest);

      assertEquals(outcome, { ok: false, code: "generation_failed" });
      assertEquals(api.bodies.length, 1);
      assertEquals(usage.length, 1);
      assertFalse(String(reported[0]).includes(sentinel));
    },
  );
});

Deno.test("an answer cut off by max_tokens is generation_failed", async () => {
  const cutOff = message(JSON.stringify(suggestion).slice(0, 20), { stop_reason: "max_tokens" });
  await withServices([{ body: cutOff }], async ({ services }) => {
    assertEquals(await services.generate(suggestionRequest), {
      ok: false,
      code: "generation_failed",
    });
  });
});

Deno.test("an answer that is not JSON is generation_failed", async () => {
  await withServices([{ body: message("Sure, here is a recipe") }], async ({ services }) => {
    assertEquals(await services.generate(suggestionRequest), {
      ok: false,
      code: "generation_failed",
    });
  });
});

Deno.test("an oversized answer is generation_failed, and nothing of it is reported", async () => {
  const oversized = { ...suggestion, name: sentinel.repeat(20) };
  await withServices(
    [{ body: message(JSON.stringify(oversized)) }],
    async ({ services, reported }) => {
      assertEquals(await services.generate(suggestionRequest), {
        ok: false,
        code: "generation_failed",
      });
      assertFalse(JSON.stringify(reported).includes(sentinel));
    },
  );
});

Deno.test(
  "a substitution with a position outside the candidate list is generation_failed",
  async () => {
    const substitution = {
      route: "recipe_generate" as const,
      userId,
      turnId,
      system: "You choose a swap.",
      userContent: "<untrusted_data>{}</untrusted_data>",
      format: substitutionSchema,
      read: (reply: unknown) => readSubstitution(reply, { candidateCount: 3 }),
    };
    await withServices(
      [
        { body: message(JSON.stringify({ positions: [1, 3] })) },
        { body: message(JSON.stringify({ positions: [2] })) },
      ],
      async ({ services }) => {
        assertEquals(await services.generate(substitution), {
          ok: false,
          code: "generation_failed",
        });
        assertEquals(await services.generate(substitution), {
          ok: true,
          value: { positions: [2] },
          model: "claude-opus-5-5",
        });
      },
    );
  },
);

Deno.test("a missing key is generation_failed with no call and no usage row", async () => {
  await withServices(
    [],
    async ({ services, api, usage }) => {
      const outcome = await services.generate(suggestionRequest);

      assertEquals(outcome, { ok: false, code: "generation_failed" });
      assertEquals(api.bodies.length, 0);
      assertEquals(usage.length, 0);
    },
    { ANTHROPIC_API_KEY: " " },
  );
});

Deno.test("a usage row that cannot be written is reported and does not fail the call", async () => {
  const api = await startMessagesApi([{ body: message(JSON.stringify(suggestion)) }]);
  const reported: unknown[] = [];
  try {
    const services = createGenerationServices({
      readEnv: (name) => ({ ANTHROPIC_API_KEY: "key", ANTHROPIC_BASE_URL: api.baseUrl })[name],
      recordUsage: () => Promise.reject(new Error("assistant usage insert failed 42501")),
      report: (_function, _code, caught) => reported.push(caught),
      hasPrice: () => true,
    });

    const outcome = await services.generate(suggestionRequest);

    assertEquals(outcome.ok, true);
    assertEquals(reported.length, 1);
  } finally {
    await api.shutdown();
  }
});

const iterationsOf = (entries: Record<string, unknown>[]) => ({
  input_tokens: 10,
  output_tokens: 20,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  iterations: entries,
});

Deno.test(
  "a response with iterations writes one usage row for each attempt, each with its own model",
  async () => {
    const served = message(JSON.stringify(suggestion), {
      model: "claude-haiku-5-5",
      usage: iterationsOf([
        {
          type: "message",
          model: "claude-opus-5-5",
          input_tokens: 4_000,
          output_tokens: 300,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        {
          type: "fallback_message",
          model: "claude-haiku-5-5",
          input_tokens: 4_000,
          output_tokens: 1_700,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 0,
        },
      ]),
    });
    await withServices([{ body: served }], async ({ services, usage }) => {
      const outcome = await services.generate(suggestionRequest);

      assertEquals(outcome.ok, true);
      assertEquals(
        usage.map((row) => [
          row.model,
          row.inputTokens,
          row.outputTokens,
          row.cacheReadInputTokens,
        ]),
        [
          ["claude-opus-5-5", 4_000, 300, 0],
          ["claude-haiku-5-5", 4_000, 1_700, 100],
        ],
      );
      assertEquals(
        usage.map((row) => row.stopReason),
        ["refusal", "end_turn"],
      );
    });
  },
);

Deno.test(
  "an unpriced fallback attempt is recorded at Opus rates beside the declined hop",
  async () => {
    const served = message(JSON.stringify(suggestion), {
      model: "claude-future-9",
      usage: iterationsOf([
        {
          type: "message",
          model: "claude-opus-5-5",
          input_tokens: 1,
          output_tokens: 2,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        {
          type: "fallback_message",
          model: "claude-future-9",
          input_tokens: 3,
          output_tokens: 4,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      ]),
    });
    await withServices([{ body: served }], async ({ services, usage }) => {
      await services.generate(suggestionRequest);

      assertEquals(
        usage.map((row) => row.model),
        ["claude-opus-5-5", "claude-opus-5-5"],
      );
    });
  },
);

Deno.test("a chain that refused throughout counts every declined attempt", async () => {
  const refused = message("", {
    content: [],
    stop_reason: "refusal",
    usage: iterationsOf([
      {
        type: "message",
        model: "claude-opus-5-5",
        input_tokens: 5,
        output_tokens: 6,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
      {
        type: "fallback_message",
        model: "claude-haiku-5-5",
        input_tokens: 7,
        output_tokens: 8,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    ]),
  });
  await withServices([{ body: refused }], async ({ services, usage }) => {
    assertEquals(await services.generate(suggestionRequest), {
      ok: false,
      code: "generation_refused",
    });
    assertEquals(usage.length, 2);
  });
});

Deno.test("a response with no iterations writes one row from the top-level usage", async () => {
  await withServices(
    [
      {
        body: message(JSON.stringify(suggestion), {
          usage: { ...iterationsOf([]), input_tokens: 9 },
        }),
      },
    ],
    async ({ services, usage }) => {
      await services.generate(suggestionRequest);

      assertEquals(usage.length, 1);
      assertEquals(usage[0]?.inputTokens, 9);
    },
  );
});

Deno.test("the answer is read from the text after the last fallback block only", async () => {
  const handover = {
    type: "fallback",
    from: { model: "claude-opus-5-5" },
    to: { model: "claude-haiku-5-5" },
    trigger: { type: "refusal" },
  };
  const served = message("", {
    model: "claude-haiku-5-5",
    content: [
      { type: "text", text: '{"name": "half a recip' },
      handover,
      { type: "text", text: JSON.stringify(suggestion) },
    ],
  });
  await withServices([{ body: served }], async ({ services }) => {
    assertEquals(await services.generate(suggestionRequest), {
      ok: true,
      value: suggestion,
      model: "claude-haiku-5-5",
    });
  });
});
