import { assert, assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import {
  assistantRecipeDraftSchema,
  buildRecipeIngredient,
  computeRecipe,
  recipeSuggestionSchema,
} from "../../core.ts";
import { getFood, listFoodPortions } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { createGenerationServices, GENERATION_TIMEOUT_MILLISECONDS } from "../generate.ts";
import { spyOnConsole } from "../testing.ts";
import { parseToolInput, toJsonSchema } from "../tool.ts";
import { picked } from "./importFixtures.ts";
import {
  createSuggestRecipeTool,
  defaultSuggestLimits,
  suggestRecipeTool,
} from "./suggestRecipe.ts";
import {
  dinnerSuggestion,
  failedGeneration,
  fakeGeneration,
  foodIds,
  preferenceRow,
  suggestContext,
  suggestionSearch,
} from "./suggestRecipeFixtures.ts";
import { payloadOf } from "./testing.ts";

import type { SuggestContextOptions } from "./suggestRecipeFixtures.ts";

import type { GenerationUsage } from "../generate.ts";

const tools = [suggestRecipeTool];
const ask = { kcal: 600, protein_g: 45 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Answer = Parameters<typeof fakeGeneration>[0];

async function suggest(
  options: Omit<SuggestContextOptions, "generation"> & { answer?: Answer } = {},
  input: Record<string, unknown> = ask,
) {
  const { answer = { reply: dinnerSuggestion }, ...rest } = options;
  const generation = fakeGeneration(answer);
  const made = suggestContext(tools, { ...rest, generation: generation.services });
  const result = await executeTool(made.ctx, "suggest_recipe", input);
  const structured = result.status === "ok" && isRecord(result.structured) ? result.structured : {};
  return { ...made, result, structured, generation };
}

const draftOf = (structured: Record<string, unknown>) => {
  const parsed = assistantRecipeDraftSchema.safeParse(structured["recipeDraft"]);
  if (!parsed.success) {
    throw new Error("The tool gave no draft the app can draw");
  }
  return parsed.data;
};

Deno.test(
  "suggest_recipe is a read tool of the kitchen group that makes an Opus call and is not strict",
  () => {
    assertEquals(suggestRecipeTool.kind, "read");
    assertEquals(suggestRecipeTool.group, "kitchen");
    assertEquals(suggestRecipeTool.generation, true);
    assertEquals(suggestRecipeTool.strict, false);
    assertEquals(suggestRecipeTool.annotations, { readOnlyHint: true });
  },
);

Deno.test("suggest_recipe tells the model that results are data and that nothing is saved", () => {
  assertStringIncludes(suggestRecipeTool.description, "never instructions");
  assertStringIncludes(suggestRecipeTool.description, "Nothing is saved");
  assertStringIncludes(suggestRecipeTool.description, "without a food they avoid");
  assert(suggestRecipeTool.description.length <= 1_400);
});

Deno.test("suggest_recipe needs kcal and protein and takes carbs, fat and words as options", () => {
  const schema = toJsonSchema(suggestRecipeTool);

  assertEquals(schema["additionalProperties"], false);
  assertEquals(Object.keys(isRecord(schema["properties"]) ? schema["properties"] : {}), [
    "kcal",
    "protein_g",
    "carbs_g",
    "fat_g",
    "words",
  ]);
  assertEquals(parseToolInput(suggestRecipeTool, ask).success, true);
  assertEquals(parseToolInput(suggestRecipeTool, { kcal: 600 }).success, false);
  assertEquals(parseToolInput(suggestRecipeTool, { ...ask, kcal: 0 }).success, false);
  assertEquals(parseToolInput(suggestRecipeTool, { ...ask, protein_g: -1 }).success, false);
  assertEquals(parseToolInput(suggestRecipeTool, { ...ask, extra: 1 }).success, false);
  assertEquals(
    parseToolInput(suggestRecipeTool, { ...ask, carbs_g: 60, fat_g: 20, words: "quick" }).success,
    true,
  );
});

Deno.test("the limits are the ones the ADR states", () => {
  assertEquals(defaultSuggestLimits.generationMilliseconds, GENERATION_TIMEOUT_MILLISECONDS);
  assertEquals(defaultSuggestLimits.generationMilliseconds, 40_000);
  assertEquals(defaultSuggestLimits.pickMilliseconds, 4_000);
  assertEquals(defaultSuggestLimits.totalMilliseconds, 50_000);
});

Deno.test(
  "the draft's figures equal computeRecipe over its lines, a per 100 ml food included",
  async () => {
    const withBroth = {
      ...dinnerSuggestion,
      ingredients: [...dinnerSuggestion.ingredients, { name: "chicken broth", grams: 300 }],
    };
    const { structured, ctx } = await suggest({ answer: { reply: withBroth } });
    const draft = draftOf(structured);
    const ingredients = await Promise.all(
      draft.ingredients.map(async ({ foodId, grams }) => {
        assert(foodId !== null);
        const food = await getFood(ctx.caller, foodId);
        assert(food !== null);
        return buildRecipeIngredient(food, {
          quantity: grams,
          unit: "g",
          foodPortions: await listFoodPortions(ctx.caller, foodId),
        });
      }),
    );
    const computed = computeRecipe({ servings: draft.servings, yieldGrams: null, ingredients });

    assertEquals(draft.ingredients.length, 4);
    assertEquals(draft.perServing, {
      kcal: computed.perServing.kcal,
      protein_g: computed.perServing.protein_g,
      carbs_g: computed.perServing.carbs_g,
      fat_g: computed.perServing.fat_g,
    });
  },
);

Deno.test("every ingredient of the draft is a real foods row, named by that row", async () => {
  const { structured, stub } = await suggest();
  const draft = draftOf(structured);
  const foods = stub.tables["foods"] ?? [];

  assertEquals(
    draft.ingredients.map(({ name, foodId }) => [name, foodId]),
    [
      ["chicken thigh", foodIds.chicken],
      ["new potatoes", foodIds.potatoes],
      ["olive oil", foodIds.oil],
    ],
  );
  for (const { foodId, foodName } of draft.ingredients) {
    assertEquals(foods.find((row) => row["id"] === foodId)?.["name"], foodName);
  }
});

Deno.test("the draft is fitted within tolerance of the figures asked for", async () => {
  const { structured } = await suggest({}, { kcal: 600, protein_g: 55 });
  const draft = draftOf(structured);

  assertEquals(draft.fit?.status, "within");
  assertEquals(draft.fit?.target, { kcal: 600, protein_g: 55 });
  assert(Math.abs((draft.perServing.kcal ?? 0) - 600) <= 30);
  assert(Math.abs((draft.perServing.protein_g ?? 0) - 55) <= 5);
});

Deno.test("carbs and fat are fitted and reported only when the person named them", async () => {
  const { structured } = await suggest({}, { ...ask, carbs_g: 40 });

  assertEquals(Object.keys(draftOf(structured).fit?.target ?? {}), [
    "kcal",
    "protein_g",
    "carbs_g",
  ]);
});

Deno.test("the draft carries the name, servings and steps of the model's recipe", async () => {
  const draft = draftOf((await suggest()).structured);

  assertEquals(draft.name, "Lemon chicken traybake");
  assertEquals(draft.servings, 2);
  assertEquals(draft.steps, dinnerSuggestion.steps);
});

Deno.test("the model gets a summary of the draft and never its lines, steps or ids", async () => {
  const { result } = await suggest();
  const payload = payloadOf(result);

  assert(isRecord(payload) && isRecord(payload["recipe"]));
  assertEquals(Object.keys(payload["recipe"]).toSorted(), [
    "fit",
    "left_out_avoided",
    "misses",
    "name",
    "not_matched",
    "per_serving",
    "servings",
  ]);
  assertFalse(result.text.includes("Roast everything"));
  assertFalse(result.text.includes(foodIds.chicken));
  assertFalse(result.text.includes("Chicken, thigh"));
});

Deno.test("the draft goes to the turn loop in structured and not to the model", async () => {
  const { result, structured } = await suggest();

  assert("recipeDraft" in structured);
  assertFalse(result.text.includes("recipeDraft"));
});

Deno.test(
  "the Opus call is made once, for the recipe_generate route, with the data wrapped",
  async () => {
    const { generation, ctx } = await suggest(
      { preferences: [preferenceRow("allergy", { label: "peanuts" })] },
      { ...ask, words: "a quick traybake" },
    );

    assertEquals(generation.calls.length, 1);
    const [call] = generation.calls;
    assertEquals(call?.route, "recipe_generate");
    assertEquals(call?.userId, ctx.userId);
    assertEquals(call?.turnId, ctx.turn.id);
    assertEquals(call?.format, recipeSuggestionSchema);
    assertEquals(call?.timeoutMilliseconds, 40_000);
    assert(call?.userContent.startsWith('<untrusted_data source="recipe_request">'));
    assertStringIncludes(call?.userContent ?? "", "a quick traybake");
  },
);

Deno.test(
  "the prompt carries the usual foods and the avoided names with no allergy label",
  async () => {
    const { generation } = await suggest({
      preferences: [
        preferenceRow("allergy", { label: "peanuts" }),
        preferenceRow("dislike", { label: "coriander" }),
      ],
    });
    const content = generation.calls[0]?.userContent ?? "";

    assertStringIncludes(content, '"avoid":["peanuts","coriander"]');
    assertStringIncludes(content, '"usual_foods":["chicken"]');
    assertFalse(/allerg|dislike/i.test(content));
  },
);

Deno.test(
  "an ingredient that matches no food stays unmatched and is left out of the numbers",
  async () => {
    const withHarissa = {
      ...dinnerSuggestion,
      ingredients: [...dinnerSuggestion.ingredients, { name: "harissa paste", grams: 30 }],
    };
    const baseline = draftOf((await suggest()).structured);
    const { structured, result } = await suggest({ answer: { reply: withHarissa } });
    const draft = draftOf(structured);

    assertEquals(draft.ingredients.at(-1), {
      name: "harissa paste",
      foodId: null,
      foodName: null,
      grams: 30,
      beforeGrams: null,
      kcal: null,
      change: "same",
    });
    assertEquals(draft.perServing, baseline.perServing);
    const payload = payloadOf(result);
    assert(isRecord(payload) && isRecord(payload["recipe"]));
    assertEquals(payload["recipe"]["not_matched"], ["harissa paste"]);
  },
);

Deno.test(
  "a food the person avoids by name is not searched for and never reaches the draft",
  async () => {
    const withMilk = {
      ...dinnerSuggestion,
      ingredients: [...dinnerSuggestion.ingredients, { name: "milk", grams: 100 }],
    };
    const { structured, queries, result } = await suggest({
      answer: { reply: withMilk },
      preferences: [preferenceRow("dislike", { label: "milk" })],
    });
    const draft = draftOf(structured);

    assertEquals(draft.dropped, [{ name: "milk", reason: "avoided" }]);
    assertFalse(draft.ingredients.some(({ name }) => name === "milk"));
    assertFalse(draft.ingredients.some(({ foodId }) => foodId === foodIds.milk));
    assertFalse(queries.includes("milk"));
    const payload = payloadOf(result);
    assert(isRecord(payload) && isRecord(payload["recipe"]));
    assertEquals(payload["recipe"]["left_out_avoided"], ["milk"]);
  },
);

Deno.test(
  "a food the person avoids by id is not offered to the pick, so a safe candidate is chosen instead",
  async () => {
    const withDrink = {
      ...dinnerSuggestion,
      ingredients: [...dinnerSuggestion.ingredients, { name: "dairy drink", grams: 100 }],
    };
    const { structured, picks } = await suggest({
      answer: { reply: withDrink },
      search: {
        ...suggestionSearch,
        "dairy drink": [
          { foodId: foodIds.milk, score: 2 },
          { foodId: foodIds.broth, score: 1 },
        ],
      },
      preferences: [preferenceRow("allergy", { foodId: foodIds.milk })],
    });
    const draft = draftOf(structured);

    const drinkOffered = picks[0]?.lines.find(({ foodWord }) => foodWord === "dairy drink");
    assertEquals(drinkOffered?.candidates.length, 1);
    assertEquals(draft.ingredients.at(-1)?.foodId, foodIds.broth);
    assertFalse(draft.ingredients.some(({ foodId }) => foodId === foodIds.milk));
  },
);

Deno.test(
  "a line whose only candidate is avoided is unmatched and never reaches the draft",
  async () => {
    const withDrink = {
      ...dinnerSuggestion,
      ingredients: [...dinnerSuggestion.ingredients, { name: "dairy drink", grams: 100 }],
    };
    const { structured } = await suggest({
      answer: { reply: withDrink },
      preferences: [preferenceRow("allergy", { foodId: foodIds.milk })],
    });

    assertEquals(draftOf(structured).ingredients.at(-1)?.foodId, null);
  },
);

Deno.test(
  "a recipe whose name or step mentions an avoided food is refused with no draft",
  async () => {
    for (const reply of [
      { ...dinnerSuggestion, name: "Milk-braised chicken" },
      { ...dinnerSuggestion, steps: ["Roast it.", "Finish with a splash of milk."] },
    ]) {
      const { result, structured } = await suggest({
        answer: { reply },
        preferences: [preferenceRow("allergy", { label: "milk" })],
      });

      assertEquals(payloadOf(result), { error: "recipe_mentions_avoided" });
      assertEquals(structured, {});
    }
  },
);

Deno.test(
  "when everything is avoided the answer is nothing_matched with the names left out",
  async () => {
    const onlyMilk = {
      ...dinnerSuggestion,
      ingredients: [{ name: "milk", grams: 200 }],
      steps: ["Warm it."],
    };
    const { result, structured } = await suggest({
      answer: { reply: onlyMilk },
      preferences: [preferenceRow("dislike", { label: "milk" })],
    });

    assertEquals(payloadOf(result), { error: "nothing_matched", left_out_avoided: ["milk"] });
    assertEquals(structured, {});
  },
);

Deno.test("the avoided food is out of the figures too", async () => {
  const withMilk = {
    ...dinnerSuggestion,
    ingredients: [...dinnerSuggestion.ingredients, { name: "milk", grams: 100 }],
  };
  const baseline = draftOf((await suggest()).structured);
  const { structured } = await suggest({
    answer: { reply: withMilk },
    preferences: [preferenceRow("allergy", { label: "milk" })],
  });

  assertEquals(draftOf(structured).perServing, baseline.perServing);
});

Deno.test(
  "a target the foods cannot reach is said so with the closest draft and the limiting names",
  async () => {
    const { structured, result } = await suggest({}, { kcal: 600, protein_g: 120 });
    const draft = draftOf(structured);

    assertEquals(draft.fit?.status, "unreachable");
    const limiting = draft.fit?.misses.flatMap(({ limitedBy }) => limitedBy) ?? [];
    assert(limiting.length > 0);
    for (const name of limiting) {
      assert(dinnerSuggestion.ingredients.some((line) => line.name === name));
    }
    assert(draft.fit?.misses.some(({ nutrient }) => nutrient === "protein_g"));
    const payload = payloadOf(result);
    assert(isRecord(payload) && isRecord(payload["recipe"]));
    assertEquals(payload["recipe"]["fit"], "unreachable");
  },
);

Deno.test("the pick is offered one list for each ingredient and chooses by position", async () => {
  const { picks } = await suggest();

  assertEquals(picks.length, 1);
  assertEquals(
    picks[0]?.lines.map(({ line, foodWord }) => [line, foodWord]),
    [
      ["450 g chicken thigh", "chicken thigh"],
      ["400 g new potatoes", "new potatoes"],
      ["15 g olive oil", "olive oil"],
    ],
  );
  assertEquals(picks[0]?.timeoutMilliseconds, 4_000);
});

Deno.test("a pick that chooses none of the offered foods leaves the line unmatched", async () => {
  const { structured } = await suggest({ pick: picked(0, null, 0) });

  assertEquals(
    draftOf(structured).ingredients.map(({ name, foodId }) => [name, foodId]),
    [
      ["chicken thigh", foodIds.chicken],
      ["olive oil", foodIds.oil],
      ["new potatoes", null],
    ],
  );
});

Deno.test(
  "a pick that gives a position outside the list is not trusted, and no draft is made",
  async () => {
    const { result, structured } = await suggest({ pick: picked(0, 7, 0) });

    assertEquals(payloadOf(result), { error: "could_not_match_foods" });
    assertEquals(structured, {});
  },
);

Deno.test("a pick that fails gives could_not_match_foods", async () => {
  const { result } = await suggest({ pick: { ok: false, code: "failed" } });

  assertEquals(payloadOf(result), { error: "could_not_match_foods" });
});

Deno.test(
  "when no ingredient matches a food the answer is nothing_matched and there is no draft",
  async () => {
    const { result, structured } = await suggest({ search: {} });

    assertEquals(payloadOf(result), { error: "nothing_matched", left_out_avoided: [] });
    assertEquals(structured, {});
  },
);

Deno.test(
  "a refusal, a timeout and a failure each give their own code, with no search and no draft",
  async () => {
    for (const code of ["generation_refused", "generation_timeout", "generation_failed"] as const) {
      const { result, structured, queries, picks } = await suggest({
        answer: failedGeneration(code),
      });

      assertEquals(result.status, "ok");
      assertEquals(payloadOf(result), { error: code });
      assertEquals(structured, {});
      assertEquals(queries, []);
      assertEquals(picks, []);
    }
  },
);

Deno.test("a reply that is not a recipe the bounds accept is generation_failed", async () => {
  const { result } = await suggest({ answer: { reply: { name: "Soup" } } });

  assertEquals(payloadOf(result), { error: "generation_failed" });
});

Deno.test(
  "a context without the generation service makes the tool fail without any search",
  async () => {
    const made = suggestContext(tools, {});
    const result = await executeTool(made.ctx, "suggest_recipe", ask);

    assertEquals(result.status, "error");
    assertEquals(result.status === "error" ? result.code : null, "tool_failed");
    assertEquals(made.queries, []);
  },
);

Deno.test("a context without the pick service fails before the Opus call is spent", async () => {
  const generation = fakeGeneration({ reply: dinnerSuggestion });
  const made = suggestContext(tools, {
    generation: generation.services,
    withoutPickServices: true,
  });
  const result = await executeTool(made.ctx, "suggest_recipe", ask);

  assertEquals(result.status === "error" ? result.code : null, "tool_failed");
  assertEquals(generation.calls.length, 0);
});

Deno.test("a pick that runs past the deadline ends the tool as timed_out", async () => {
  const slow = createSuggestRecipeTool({ ...defaultSuggestLimits, totalMilliseconds: 100 });
  const made = suggestContext([slow], {
    generation: fakeGeneration({ reply: dinnerSuggestion }).services,
    pick: async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return picked(0, 0, 0);
    },
  });

  const result = await executeTool(made.ctx, "suggest_recipe", ask);

  assertEquals(payloadOf(result), { error: "timed_out" });
  assertEquals(result.status === "ok" ? result.structured : "x", null);
});

// The deadline runs from the start of the tool, so a slow palate read is `timed_out` and not the host's abort. The
// limits are real and small, because Deno has no fake clock in this suite's imports.
Deno.test(
  "a slow palate read ends the tool as timed_out before the Opus call is made",
  async () => {
    const quick = createSuggestRecipeTool({ ...defaultSuggestLimits, totalMilliseconds: 50 });
    const generation = fakeGeneration({ reply: dinnerSuggestion });
    const made = suggestContext([quick], { generation: generation.services });
    const slowCaller = new Proxy(made.ctx.caller, {
      get(target, property, receiver) {
        if (property !== "from") {
          return Reflect.get(target, property, receiver);
        }
        return (table: Parameters<typeof target.from>[0]) =>
          table === "palate_logged_days"
            ? {
                select: () => ({
                  maybeSingle: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    return { data: { logged_days: 10 }, error: null };
                  },
                }),
              }
            : target.from(table);
      },
    });

    const result = await executeTool({ ...made.ctx, caller: slowCaller }, "suggest_recipe", ask);

    assertEquals(payloadOf(result), { error: "timed_out" });
    assertEquals(generation.calls.length, 0);
  },
);

Deno.test("the Opus call is given no more than what is left of the deadline", async () => {
  const short = createSuggestRecipeTool({
    ...defaultSuggestLimits,
    totalMilliseconds: 30_000,
    generationMilliseconds: 40_000,
  });
  const generation = fakeGeneration({ reply: dinnerSuggestion });
  await executeTool(
    suggestContext([short], { generation: generation.services }).ctx,
    "suggest_recipe",
    ask,
  );

  const given = generation.calls[0]?.timeoutMilliseconds ?? Infinity;
  assert(given <= 30_000 && given > 20_000);
});

Deno.test("the tool writes nothing and logs nothing of the person's", async () => {
  const spy = spyOnConsole();
  try {
    const { stub, reported } = await suggest({
      preferences: [preferenceRow("allergy", { label: "peanuts" })],
    });

    assertEquals(
      stub.calls.filter(({ method }) => method === "insert" || method === "update"),
      [],
    );
    assertEquals(reported, []);
    for (const line of spy.lines) {
      assertFalse(/chicken|potato|traybake|peanut/i.test(line));
    }
  } finally {
    spy.restore();
  }
});

// The real call, against a Messages API that is a local server, so the usage rows are the ones `generate.ts` writes.
async function withMessagesApi<T>(
  reply: { status?: number; body?: unknown; hang?: boolean } | null,
  run: (setup: { baseUrl: string; usage: GenerationUsage[] }) => Promise<T>,
): Promise<T> {
  const listening = Promise.withResolvers<number>();
  const stopped = Promise.withResolvers<void>();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: ({ port }) => listening.resolve(port) },
    async () => {
      if (reply?.hang === true) {
        await stopped.promise;
        return new Response(null, { status: 499 });
      }
      return Response.json(reply?.body ?? {}, { status: reply?.status ?? 200 });
    },
  );
  try {
    const port = await listening.promise;
    return await run({ baseUrl: `http://127.0.0.1:${reply === null ? 1 : port}`, usage: [] });
  } finally {
    stopped.resolve();
    await server.shutdown();
  }
}

const messageOf = (text: string, stopReason = "end_turn") => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: {
    input_tokens: 3_000,
    output_tokens: 900,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
});

async function suggestThroughOpus(
  reply: Parameters<typeof withMessagesApi>[0],
  generationMilliseconds = 40_000,
) {
  return await withMessagesApi(reply, async ({ baseUrl, usage }) => {
    const rows: GenerationUsage[] = usage;
    const services = createGenerationServices({
      readEnv: (name) => ({ ANTHROPIC_API_KEY: "key-sentinel", ANTHROPIC_BASE_URL: baseUrl })[name],
      recordUsage: (call) => {
        rows.push(call);
        return Promise.resolve();
      },
      report: () => {},
      hasPrice: (model) => model === "claude-opus-5-5",
    });
    const tool = createSuggestRecipeTool({ ...defaultSuggestLimits, generationMilliseconds });
    const made = suggestContext([tool], { generation: services });
    const result = await executeTool(made.ctx, "suggest_recipe", ask);
    return { result, rows };
  });
}

Deno.test(
  "one recipe_generate usage row is written for the Opus call, and the draft is made",
  async () => {
    const { result, rows } = await suggestThroughOpus({
      body: messageOf(JSON.stringify(dinnerSuggestion)),
    });

    assertEquals(rows.length, 1);
    assertEquals(rows[0]?.route, "recipe_generate");
    assertEquals(rows[0]?.model, "claude-opus-5-5");
    assert(result.status === "ok" && isRecord(result.structured));
    assert("recipeDraft" in result.structured);
  },
);

Deno.test("a refusal from the model gives generation_refused and still one usage row", async () => {
  const { result, rows } = await suggestThroughOpus({
    body: messageOf("", "refusal"),
  });

  assertEquals(payloadOf(result), { error: "generation_refused" });
  assertEquals(rows.length, 1);
  assertEquals(rows[0]?.stopReason, "refusal");
});

Deno.test(
  "an Opus call that runs past its timeout gives generation_timeout and one usage row",
  async () => {
    const { result, rows } = await suggestThroughOpus({ hang: true }, 100);

    assertEquals(payloadOf(result), { error: "generation_timeout" });
    assertEquals(rows.length, 1);
    assertEquals(rows[0]?.route, "recipe_generate");
  },
);

Deno.test(
  "an Opus call that cannot be reached gives generation_failed and one usage row",
  async () => {
    const { result, rows } = await suggestThroughOpus(null);

    assertEquals(payloadOf(result), { error: "generation_failed" });
    assertEquals(rows.length, 1);
  },
);
