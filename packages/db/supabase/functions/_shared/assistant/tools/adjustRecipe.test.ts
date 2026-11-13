import { assert, assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import {
  assistantRecipeDraftSchema,
  assistantRecipeRefusalSchema,
  buildRecipeIngredient,
  computeRecipe,
  substitutionSchema,
} from "../../core.ts";
import { getFood } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { createGenerationServices } from "../generate.ts";
import { spyOnConsole } from "../testing.ts";
import { parseToolInput, toJsonSchema } from "../tool.ts";
import { adjustRecipeTool, createAdjustRecipeTool, defaultAdjustLimits } from "./adjustRecipe.ts";
import {
  adjustContext,
  adjustFoodIds,
  chickenAndRice,
  chickenAndRiceId,
  porridgeId,
} from "./adjustRecipeFixtures.ts";
import { failedGeneration, fakeGeneration, preferenceRow } from "./suggestRecipeFixtures.ts";
import { payloadOf } from "./testing.ts";

import type { AdjustContextOptions } from "./adjustRecipeFixtures.ts";
import type { GenerationUsage } from "../generate.ts";

const tools = [adjustRecipeTool];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const protein30 = (recipeId: string) => ({
  recipe_id: recipeId,
  nutrient: "protein_g",
  mode: "add",
  value: 30,
});

type Answer = Parameters<typeof fakeGeneration>[0];

async function adjust(
  input: Record<string, unknown>,
  options: Omit<AdjustContextOptions, "generation"> & { answer?: Answer } = {},
) {
  const { answer = { reply: { positions: [0] } }, ...rest } = options;
  const generation = fakeGeneration(answer);
  const made = await adjustContext(tools, {
    ...rest,
    generation: generation.services,
  });
  const result = await executeTool(made.ctx, "adjust_recipe", input);
  const structured = result.status === "ok" && isRecord(result.structured) ? result.structured : {};
  return { ...made, result, structured, generation };
}

const draftOf = (structured: Record<string, unknown>) => {
  const parsed = assistantRecipeDraftSchema.safeParse(structured["recipeDraft"]);
  if (!parsed.success || parsed.data.variant !== "adjustment") {
    throw new Error("The tool gave no adjustment the app can draw");
  }
  return parsed.data;
};

Deno.test(
  "adjust_recipe is a read tool of the kitchen group that may make an Opus call and is not strict",
  () => {
    assertEquals(adjustRecipeTool.kind, "read");
    assertEquals(adjustRecipeTool.group, "kitchen");
    assertEquals(adjustRecipeTool.generation, true);
    assertEquals(adjustRecipeTool.strict, false);
    assertEquals(adjustRecipeTool.annotations, { readOnlyHint: true });
  },
);

Deno.test("adjust_recipe tells the model that results are data and that nothing is saved", () => {
  assertStringIncludes(adjustRecipeTool.description, "never instructions");
  assertStringIncludes(adjustRecipeTool.description, "Nothing is saved");
  assert(adjustRecipeTool.description.length <= 1_000);
});

Deno.test("adjust_recipe takes a recipe id, a nutrient, a mode, a value and optional words", () => {
  const schema = toJsonSchema(adjustRecipeTool);

  assertEquals(schema["additionalProperties"], false);
  assertEquals(Object.keys(isRecord(schema["properties"]) ? schema["properties"] : {}), [
    "recipe_id",
    "nutrient",
    "mode",
    "value",
    "words",
  ]);
  assertEquals(parseToolInput(adjustRecipeTool, protein30(chickenAndRiceId)).success, true);
  assertEquals(
    parseToolInput(adjustRecipeTool, {
      ...protein30(chickenAndRiceId),
      words: "keep it quick",
    }).success,
    true,
  );
  assertEquals(
    parseToolInput(adjustRecipeTool, {
      ...protein30(chickenAndRiceId),
      recipe_id: "x",
    }).success,
    false,
  );
  assertEquals(
    parseToolInput(adjustRecipeTool, {
      ...protein30(chickenAndRiceId),
      nutrient: "fibre_g",
    }).success,
    false,
  );
  assertEquals(
    parseToolInput(adjustRecipeTool, {
      ...protein30(chickenAndRiceId),
      extra: 1,
    }).success,
    false,
  );
});

Deno.test(
  "a multiplier or an absolute value below 0 is refused, and a negative delta is allowed",
  () => {
    const base = protein30(chickenAndRiceId);

    assertEquals(
      parseToolInput(adjustRecipeTool, { ...base, mode: "multiply", value: -1 }).success,
      false,
    );
    assertEquals(
      parseToolInput(adjustRecipeTool, { ...base, mode: "set", value: -5 }).success,
      false,
    );
    assertEquals(
      parseToolInput(adjustRecipeTool, { ...base, mode: "add", value: -20 }).success,
      true,
    );
  },
);

Deno.test("the limits are the ones the ADR states", () => {
  assertEquals(defaultAdjustLimits.totalMilliseconds, 50_000);
  assertEquals(defaultAdjustLimits.generationMilliseconds, 40_000);
});

Deno.test("chicken and rice reaches +30 g protein by scaling, with no Opus call", async () => {
  const { structured, generation, result } = await adjust(protein30(chickenAndRiceId));
  const draft = draftOf(structured);

  assertEquals(generation.calls.length, 0);
  assertEquals(draft.fit?.status, "within");
  assertEquals(draft.recipeId, chickenAndRiceId);
  assertEquals(draft.fit?.target.protein_g !== undefined, true);
  assert(Math.abs((draft.perServing.protein_g ?? 0) - 79.3) <= 5);
  assert(Math.abs((draft.perServing.kcal ?? 0) - 518) <= 518 * 0.05);
  assert(draft.ingredients.every(({ change }) => change !== "added"));
  assertEquals(draft.before.protein_g !== null && Math.round(draft.before.protein_g), 49);
  assertStringIncludes(result.text, "per_serving");
});

Deno.test("the figures after equal computeRecipe over the lines of the draft", async () => {
  const { structured, ctx } = await adjust(protein30(chickenAndRiceId));
  const draft = draftOf(structured);
  const ingredients = await Promise.all(
    draft.ingredients.map(async ({ foodId, grams }) => {
      assert(foodId !== null);
      const food = await getFood(ctx.caller, foodId);
      assert(food !== null);
      return buildRecipeIngredient(food, { quantity: grams, unit: "g" });
    }),
  );
  const computed = computeRecipe({
    servings: draft.servings,
    yieldGrams: null,
    ingredients,
  });

  assertEquals(draft.perServing, {
    kcal: computed.perServing.kcal,
    protein_g: computed.perServing.protein_g,
    carbs_g: computed.perServing.carbs_g,
    fat_g: computed.perServing.fat_g,
  });
});

Deno.test(
  "the original recipe row is unchanged after the tool runs, and nothing is written",
  async () => {
    const made = await adjustContext(tools, {
      generation: fakeGeneration({ reply: { positions: [0] } }).services,
    });
    const before = structuredClone(made.stub.tables["recipes"]);
    const beforeCalls = made.stub.calls.length;

    await executeTool(made.ctx, "adjust_recipe", protein30(chickenAndRiceId));
    await executeTool(made.ctx, "adjust_recipe", protein30(porridgeId));

    assertEquals(made.stub.tables["recipes"], before);
    assertEquals(
      made.stub.calls.slice(beforeCalls).filter(({ method }) => method !== "select"),
      [],
    );
    assertEquals(made.stub.tables["recipe_ingredients"], undefined);
  },
);

Deno.test(
  "the model gets a summary with the figures before and after and no line or step",
  async () => {
    const { result } = await adjust(protein30(chickenAndRiceId));
    const payload = payloadOf(result);

    assert(isRecord(payload) && isRecord(payload["recipe"]));
    assertEquals(Object.keys(payload["recipe"]).toSorted(), [
      "added_not_in_method",
      "before",
      "fit",
      "left_out_avoided",
      "misses",
      "name",
      "not_matched",
      "per_serving",
      "servings",
    ]);
    assertFalse(result.text.includes("Grill the chicken"));
    assertFalse(result.text.includes(adjustFoodIds.chicken));
  },
);

Deno.test("the draft goes to the turn loop in structured and not to the model", async () => {
  const { result, structured } = await adjust(protein30(chickenAndRiceId));

  assert("recipeDraft" in structured);
  assertFalse(result.text.includes("recipeDraft"));
});

Deno.test(
  "porridge +30 g protein asks Opus once, for the recipe_generate route, to choose by position",
  async () => {
    const { generation, ctx, structured } = await adjust(protein30(porridgeId));

    assertEquals(generation.calls.length, 1);
    const [call] = generation.calls;
    assertEquals(call?.route, "recipe_generate");
    assertEquals(call?.userId, ctx.userId);
    assertEquals(call?.turnId, ctx.turn.id);
    assertEquals(call?.format, substitutionSchema);
    assertEquals(call?.timeoutMilliseconds, 40_000);
    assert(call?.userContent.startsWith('<untrusted_data source="adjust_request">'));
    assertStringIncludes(call?.userContent ?? "", '"position":0');
    assertStringIncludes(call?.userContent ?? "", "Chicken");
    assertStringIncludes(call?.userContent ?? "", "Yogurt");
    const draft = draftOf(structured);
    assertEquals(draft.ingredients.filter(({ change }) => change === "added").length, 1);
    assertEquals(draft.fit?.status, "within");
  },
);

Deno.test(
  "the figures of a draft with an added food are core's, and within tolerance",
  async () => {
    const { structured, ctx } = await adjust(protein30(porridgeId));
    const draft = draftOf(structured);
    const ingredients = await Promise.all(
      draft.ingredients.map(async ({ foodId, grams }) => {
        assert(foodId !== null);
        const food = await getFood(ctx.caller, foodId);
        assert(food !== null);
        return buildRecipeIngredient(food, { quantity: grams, unit: "g" });
      }),
    );
    const computed = computeRecipe({
      servings: draft.servings,
      yieldGrams: null,
      ingredients,
    });

    assertEquals(draft.perServing.protein_g, computed.perServing.protein_g);
    assertEquals(draft.perServing.kcal, computed.perServing.kcal);
    assert(Math.abs((draft.perServing.protein_g ?? 0) - 43.3) <= 5);
    assert(Math.abs((draft.perServing.kcal ?? 0) - 389.4) <= 389.4 * 0.05);
  },
);

Deno.test(
  "the candidates are the usual foods, without the recipe's own foods or an avoided food",
  async () => {
    const { generation } = await adjust(protein30(porridgeId), {
      usualFoods: [
        adjustFoodIds.oats,
        adjustFoodIds.chicken,
        adjustFoodIds.peanutButter,
        adjustFoodIds.yogurt,
      ],
      preferences: [preferenceRow("allergy", { label: "peanuts" })],
    });
    const content = generation.calls[0]?.userContent ?? "";

    assertStringIncludes(content, "Chicken");
    assertStringIncludes(content, "Yogurt");
    assertFalse(/peanut/i.test(content));
    assertFalse(/"food":"Porridge oats/.test(content));
    assertFalse(/allerg|dislike/i.test(content));
  },
);

Deno.test(
  "an avoided food is never in the draft, even one the model could have chosen",
  async () => {
    const { structured } = await adjust(protein30(porridgeId), {
      answer: { reply: { positions: [0] } },
      usualFoods: [adjustFoodIds.peanutButter, adjustFoodIds.chicken],
      preferences: [preferenceRow("allergy", { label: "peanuts" })],
    });
    const draft = draftOf(structured);

    assertFalse(draft.ingredients.some(({ foodId }) => foodId === adjustFoodIds.peanutButter));
    assert(draft.ingredients.some(({ foodId }) => foodId === adjustFoodIds.chicken));
  },
);

Deno.test(
  "a recipe that holds an avoided ingredient is refused, naming it, with no Opus call",
  async () => {
    const withPeanuts = {
      ...chickenAndRice,
      lines: [...chickenAndRice.lines, { foodId: adjustFoodIds.peanutButter, grams: 20 }],
    };
    const { result, structured, generation } = await adjust(protein30(chickenAndRiceId), {
      withRecipes: [withPeanuts],
      preferences: [preferenceRow("allergy", { label: "peanuts" })],
    });

    assertEquals(payloadOf(result), {
      error: "recipe_has_avoided_ingredient",
      foods: ["Peanut butter, smooth"],
    });
    assertEquals(generation.calls.length, 0);
    assertEquals("recipeDraft" in structured, false);
  },
);

Deno.test(
  "the draft uses what the ingredients were saved with, not the foods as they are now",
  async () => {
    const made = await adjustContext(tools, {});
    const stored = made.stub.tables["recipes"]?.find((row) => row["id"] === chickenAndRiceId);
    const savedKcal = isRecord(stored?.["computed"]) ? stored["computed"]["perServing"] : null;
    assert(isRecord(savedKcal));
    for (const food of made.stub.tables["foods"] ?? []) {
      food["kcal"] = 900;
      food["protein_g"] = 1;
    }

    const result = await executeTool(made.ctx, "adjust_recipe", protein30(chickenAndRiceId));
    const draft = draftOf(
      result.status === "ok" && isRecord(result.structured) ? result.structured : {},
    );

    assertEquals(draft.before.kcal, savedKcal["kcal"]);
    assertEquals(draft.before.protein_g, savedKcal["protein_g"]);
    assert(Math.abs((draft.perServing.kcal ?? 0) - Number(savedKcal["kcal"])) <= 518 * 0.05);
  },
);

Deno.test("a recipe that names an avoided food in its name is refused", async () => {
  const { result, structured } = await adjust(protein30(chickenAndRiceId), {
    withRecipes: [{ ...chickenAndRice, name: "Peanut chicken" }],
    preferences: [preferenceRow("allergy", { label: "peanuts" })],
  });

  assertEquals(payloadOf(result), { error: "recipe_mentions_avoided" });
  assertEquals("recipeDraft" in structured, false);
});

Deno.test(
  "when no food makes it reachable the answer is an honest refusal with the misses",
  async () => {
    const { result, structured, generation } = await adjust(protein30(porridgeId), {
      answer: { reply: { positions: [] } },
    });
    const payload = payloadOf(result);

    assertEquals(generation.calls.length, 1);
    assert(isRecord(payload));
    assertEquals(payload["error"], "could_not_reach_target");
    assert(Array.isArray(payload["misses"]));
    const protein = payload["misses"].find(
      (miss) => isRecord(miss) && miss["nutrient"] === "protein_g",
    );
    assert(isRecord(protein));
    assert(typeof protein["achieved"] === "number" && protein["achieved"] < 30);
    assertEquals(payload["tried_foods"], []);
    assertEquals("recipeDraft" in structured, false);
  },
);

Deno.test(
  "a refusal sends the app the figures for the refused card, which the model never sees",
  async () => {
    const { result, structured } = await adjust(protein30(porridgeId), {
      answer: { reply: { positions: [] } },
    });
    const refusal = assistantRecipeRefusalSchema.parse(structured["recipeRefusal"]);

    assertEquals(refusal.recipeName, "Eval porridge bowl");
    assertEquals(refusal.nutrient, "protein_g");
    assert(refusal.reached < refusal.target);
    // The closest fit drifted past the calories held, so the card has no "near its" clause to say.
    assertEquals(refusal.reachedKcal, null);
    assertEquals(Object.keys(structured), ["recipeRefusal"]);
    assertFalse(JSON.stringify(payloadOf(result)).includes("recipeRefusal"));
  },
);

Deno.test(
  "a refusal after the chooser tried a food draws the card too, because the foods really were tried",
  async () => {
    const { structured } = await adjust(protein30(porridgeId), {
      usualFoods: [adjustFoodIds.rice],
      answer: { reply: { positions: [0] } },
    });

    assert("recipeRefusal" in structured);
  },
);

Deno.test("a food that does not close the gap is refused too, naming what it tried", async () => {
  const { result, structured } = await adjust(protein30(porridgeId), {
    usualFoods: [adjustFoodIds.rice],
    answer: { reply: { positions: [0] } },
  });
  const payload = payloadOf(result);

  assert(isRecord(payload));
  assertEquals(payload["error"], "could_not_reach_target");
  assertEquals(payload["tried_foods"], ["Rice, white, long grain, boiled in unsalted water"]);
  assertEquals(structured["recipeDraft"], undefined);
});

Deno.test(
  "with no usual food to offer there is no Opus call, only the refusal and no card",
  async () => {
    const { result, generation, structured } = await adjust(protein30(porridgeId), {
      usualFoods: [],
    });

    const payload = payloadOf(result);

    assertEquals(generation.calls.length, 0);
    assert(isRecord(payload));
    assertEquals(payload["error"], "could_not_reach_target");
    // No food was offered, so the card, which speaks for the person's foods, is not drawn.
    assertEquals(structured, {});
  },
);

Deno.test(
  "a position outside the candidates leaves no draft and says the chooser failed",
  async () => {
    const { result, structured } = await adjust(protein30(porridgeId), {
      answer: { reply: { positions: [7] } },
    });
    const payload = payloadOf(result);

    assert(isRecord(payload));
    assertEquals(payload["error"], "could_not_reach_target");
    assertEquals(payload["chooser"], "unavailable");
    assertEquals("recipeDraft" in structured, false);
    // The foods were not really judged, so the card, which says none of them makes a sensible addition, is not drawn.
    assertEquals(structured, {});
  },
);

Deno.test(
  "a refused or failed Opus call gives the scaling misses and an unavailable chooser",
  async () => {
    for (const code of ["generation_refused", "generation_failed"] as const) {
      const { result, structured } = await adjust(protein30(porridgeId), {
        answer: failedGeneration(code),
      });
      const payload = payloadOf(result);

      assert(isRecord(payload));
      assertEquals(payload["error"], "could_not_reach_target");
      assertEquals(payload["chooser"], "unavailable");
      assertEquals(payload["tried_foods"], []);
      assert(Array.isArray(payload["misses"]) && payload["misses"].length > 0);
      assertEquals("recipeDraft" in structured, false);
      assertEquals(structured, {});
    }
  },
);

Deno.test(
  "an Opus call that times out is generation_timeout, with a notice for the app",
  async () => {
    const { result, structured } = await adjust(protein30(porridgeId), {
      answer: failedGeneration("generation_timeout"),
    });

    assertEquals(payloadOf(result), { error: "generation_timeout" });
    assertEquals(structured, { recipeNotice: { code: "timed_out" } });
  },
);

Deno.test("a recipe that is not found, or not the caller's, is recipe_not_found", async () => {
  const { result } = await adjust(protein30("00000000-0000-4000-8000-0000000d9999"));

  assertEquals(payloadOf(result), { error: "recipe_not_found" });
});

Deno.test("a slow read ends the tool as timed_out before any Opus call", async () => {
  const quick = createAdjustRecipeTool({
    ...defaultAdjustLimits,
    totalMilliseconds: 50,
  });
  const generation = fakeGeneration({ reply: { positions: [0] } });
  const made = await adjustContext([quick], {
    generation: generation.services,
  });
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

  const result = await executeTool(
    { ...made.ctx, caller: slowCaller },
    "adjust_recipe",
    protein30(porridgeId),
  );

  assertEquals(payloadOf(result), { error: "timed_out" });
  assertEquals(result.status === "ok" ? result.structured : "x", {
    recipeNotice: { code: "timed_out" },
  });
  assertEquals(generation.calls.length, 0);
});

Deno.test("an Opus call that outlasts the deadline ends the tool as timed_out", async () => {
  const quick = createAdjustRecipeTool({
    ...defaultAdjustLimits,
    totalMilliseconds: 150,
  });
  const made = await adjustContext([quick], {
    generation: {
      generate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { ok: false, code: "generation_failed" };
      },
    },
  });

  const result = await executeTool(made.ctx, "adjust_recipe", protein30(porridgeId));

  assertEquals(payloadOf(result), { error: "timed_out" });
});

Deno.test("the Opus call is given no more than what is left of the deadline", async () => {
  const short = createAdjustRecipeTool({
    ...defaultAdjustLimits,
    totalMilliseconds: 30_000,
    generationMilliseconds: 40_000,
  });
  const generation = fakeGeneration({ reply: { positions: [0] } });
  const made = await adjustContext([short], {
    generation: generation.services,
  });
  await executeTool(made.ctx, "adjust_recipe", protein30(porridgeId));

  const given = generation.calls[0]?.timeoutMilliseconds ?? Infinity;
  assert(given <= 30_000 && given > 20_000);
});

Deno.test("the tool logs nothing of the person's", async () => {
  const spy = spyOnConsole();
  try {
    const { reported } = await adjust(protein30(porridgeId), {
      preferences: [preferenceRow("allergy", { label: "peanuts" })],
    });

    assertEquals(reported, []);
    for (const line of spy.lines) {
      assertFalse(/chicken|porridge|oats|peanut/i.test(line));
    }
  } finally {
    spy.restore();
  }
});

// The real call, against a Messages API that is a local server, so the usage rows are the ones `generate.ts` writes.
async function withUsageRows<T>(
  body: unknown,
  run: (
    services: ReturnType<typeof createGenerationServices>,
    rows: GenerationUsage[],
  ) => Promise<T>,
): Promise<T> {
  const listening = Promise.withResolvers<number>();
  const server = Deno.serve(
    {
      hostname: "127.0.0.1",
      port: 0,
      onListen: ({ port }) => listening.resolve(port),
    },
    () => Response.json(body),
  );
  try {
    const port = await listening.promise;
    const rows: GenerationUsage[] = [];
    const services = createGenerationServices({
      readEnv: (name) =>
        ({
          ANTHROPIC_API_KEY: "key-sentinel",
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
        })[name],
      recordUsage: (call) => {
        rows.push(call);
        return Promise.resolve();
      },
      report: () => {},
      hasPrice: (model) => model === "claude-opus-5-5",
    });
    return await run(services, rows);
  } finally {
    await server.shutdown();
  }
}

const messageOf = (text: string) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 1_000,
    output_tokens: 100,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
});

Deno.test("scaling writes no usage row, and a substitution writes exactly one", async () => {
  await withUsageRows(messageOf(JSON.stringify({ positions: [0] })), async (services, rows) => {
    const scaled = await adjustContext(tools, { generation: services });
    await executeTool(scaled.ctx, "adjust_recipe", protein30(chickenAndRiceId));
    assertEquals(rows.length, 0);

    const substituted = await adjustContext(tools, { generation: services });
    const result = await executeTool(substituted.ctx, "adjust_recipe", protein30(porridgeId));
    assertEquals(rows.length, 1);
    assertEquals(rows[0]?.route, "recipe_generate");
    assert(result.status === "ok" && isRecord(result.structured));
    assert("recipeDraft" in result.structured);
  });
});
