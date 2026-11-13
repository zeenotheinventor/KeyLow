import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { executeTool } from "../executor.ts";
import { undoAction } from "../undo.ts";
import { toJsonSchema } from "../tool.ts";
import { planMealsTool } from "./planMeals.ts";
import { peanutStewId, planContext, scriptedGeneration } from "./planMealsFixtures.ts";
import { payloadOf } from "./testing.ts";
import { structuredOf } from "./writeFixtures.ts";

const input = {
  start_date: null,
  days: null,
  max_repeats: null,
  named_macros: [] as string[],
  request: null,
};

const ranking = { ranking: ["r1", "r2", "f1", "f2"] };

type Day = {
  local_date: string;
  status: string;
  kcal: number;
  protein_g: number;
  target_kcal: number;
  target_protein_g: number;
};

const daysOf = (result: Awaited<ReturnType<typeof executeTool>>): Day[] => {
  const payload = payloadOf(result) as { days: Day[] };
  return payload.days;
};

const recipeUses = (saved: { items: unknown[] }) => {
  const uses = new Map<string, number>();
  for (const item of saved.items as { item_type: string; recipe_id?: string }[]) {
    if (item.item_type === "recipe" && item.recipe_id !== undefined) {
      uses.set(item.recipe_id, (uses.get(item.recipe_id) ?? 0) + 1);
    }
  }
  return uses;
};

Deno.test("plan_meals is a kitchen write that makes a generation call", () => {
  assertEquals(planMealsTool.name, "plan_meals");
  assertEquals(planMealsTool.group, "kitchen");
  assertEquals(planMealsTool.generation, true);
  assertEquals(planMealsTool.kind, "write");
  assertEquals(planMealsTool.targetTable, "meal_plans");
  assertEquals(planMealsTool.needsConfirmation, undefined);
  assert(planMealsTool.description.length < 400);
  assertFalse("confirmation_id" in (toJsonSchema(planMealsTool)["properties"] as object));
});

Deno.test(
  "a plan meets each day's targets within tolerance and saves with the ranking",
  async () => {
    const { generation, calls } = scriptedGeneration([ranking]);
    const { ctx, saved } = planContext(planMealsTool, { generation });

    const result = await executeTool(ctx, "plan_meals", input);

    assertEquals(result.status, "ok");
    const days = daysOf(result);
    assertEquals(days.length, 7);
    for (const day of days) {
      assertEquals(day.status, "within");
      assert(
        Math.abs(day.kcal - day.target_kcal) <= day.target_kcal * 0.05,
        `${day.local_date} kcal`,
      );
      assert(Math.abs(day.protein_g - day.target_protein_g) <= 5, `${day.local_date} protein`);
    }
    assertEquals(calls.length, 1);
    assertEquals(saved.length, 1);
    assertObjectMatch(saved[0]?.plan ?? {}, {
      start_date: "2026-11-16",
      day_count: 7,
      source: "assistant",
      rules: { maxRepeats: 2, leftovers: true },
    });
    const rules = saved[0]?.plan["rules"] as { ranking: string[] };
    assertEquals(rules.ranking.length > 0, true);
  },
);

Deno.test("the card's numbers are core's totals for the saved plan", async () => {
  const { generation } = scriptedGeneration([ranking]);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  const result = await executeTool(ctx, "plan_meals", input);

  const card = structuredOf(result)["card"] as {
    kind: string;
    title: string;
    days: { name: string; summary: string }[];
    undo: string;
  };
  assertEquals(card.kind, "plan_created");
  assertEquals(card.title, "Planned 7 days, Mon 16 to Sun 22 Nov");
  assertEquals(card.undo, "available");
  const items = saved[0]?.items as { local_date: string; nutrients: { kcal: number } }[];
  const mondayKcal = items
    .filter((item) => item.local_date === "2026-11-16")
    .reduce((sum, item) => sum + item.nutrients.kcal, 0);
  assertStringIncludes(
    card.days[0]?.name ?? "",
    `${Math.round(mondayKcal).toLocaleString("en-GB")} of 1,300 kcal`,
  );
});

Deno.test(
  "the repeat limit is the request, then the profile, then 2, and the card says which",
  async () => {
    const cases = [
      { profile: {}, request: null, limit: 2, note: "Change it in plan settings." },
      {
        profile: { meal_plan_repeat_limit: 3 },
        request: null,
        limit: 3,
        note: "as set in plan settings",
      },
      { profile: { meal_plan_repeat_limit: 3 }, request: 1, limit: 1, note: "as you asked" },
    ];
    for (const { profile, request, limit, note } of cases) {
      const { generation } = scriptedGeneration([ranking]);
      const { ctx, saved } = planContext(planMealsTool, { generation, profile });

      const result = await executeTool(ctx, "plan_meals", { ...input, max_repeats: request });

      assertEquals((saved[0]?.plan["rules"] as { maxRepeats: number }).maxRepeats, limit);
      for (const [, uses] of recipeUses(saved[0] ?? { items: [] })) {
        assert(uses <= limit, `a recipe appeared ${uses} times against a limit of ${limit}`);
      }
      assertStringIncludes((structuredOf(result)["card"] as { note: string }).note, note);
    }
  },
);

Deno.test(
  "no limit is stored as null, from the profile or the request, and the card says nothing of it",
  async () => {
    for (const [profile, request] of [
      [{ meal_plan_repeat_limit: 0 }, null],
      [{}, 0],
    ] as const) {
      const { generation } = scriptedGeneration([ranking]);
      const { ctx, saved } = planContext(planMealsTool, { generation, profile });

      const result = await executeTool(ctx, "plan_meals", { ...input, max_repeats: request });

      assertEquals((saved[0]?.plan["rules"] as { maxRepeats: unknown }).maxRepeats, null);
      assertFalse(JSON.stringify(structuredOf(result)).includes("Recipes repeat"));
      assertEquals(
        daysOf(result).every(({ status }) => status === "within"),
        true,
      );
    }
  },
);

Deno.test("only calories and protein are judged unless carbs or fat are named", async () => {
  const quiet = planContext(planMealsTool, {
    generation: scriptedGeneration([ranking]).generation,
  });
  const named = planContext(planMealsTool, {
    generation: scriptedGeneration([ranking]).generation,
  });

  await executeTool(quiet.ctx, "plan_meals", input);
  await executeTool(named.ctx, "plan_meals", { ...input, named_macros: ["carbs_g", "fat_g"] });

  const targetOf = (saved: { days: unknown[] }) => (saved.days[0] as { target: object }).target;
  assertEquals(targetOf(quiet.saved[0] ?? { days: [] }), { kcal: 1300, protein_g: 90 });
  assertEquals(targetOf(named.saved[0] ?? { days: [] }), {
    kcal: 1300,
    protein_g: 90,
    carbs_g: 150,
    fat_g: 50,
  });
});

Deno.test(
  "the ranking prompt holds names and codes only, with no avoided food and no label for why",
  async () => {
    const { generation, calls } = scriptedGeneration([ranking]);
    const { ctx } = planContext(planMealsTool, {
      generation,
      tables: {
        palate_preferences: [
          {
            id: "00000000-0000-4000-8000-0000000000b1",
            kind: "allergy",
            food_id: null,
            recipe_id: null,
            label: "peanuts",
            created_at: "2026-11-01T10:00:00+00:00",
          },
        ],
        recipes: [
          {
            id: peanutStewId,
            owner_id: "00000000-0000-4000-8000-0000000000a1",
            name: "Peanut stew",
            servings: 2,
            yield_grams: 600,
            is_archived: false,
            computed: {
              total: { kcal: 900, protein_g: 40, fat_g: 40, carbs_g: 60, fibre_g: 5 },
              perServing: { kcal: 450, protein_g: 20, fat_g: 20, carbs_g: 30, fibre_g: 2 },
              per100g: { kcal: 150, protein_g: 7, fat_g: 7, carbs_g: 10, fibre_g: 1 },
              totalGrams: 600,
              effectiveGrams: 600,
              servingsOnly: false,
              engineVersion: 1,
            },
          },
        ],
      },
    });

    await executeTool(ctx, "plan_meals", { ...input, request: "plenty of eggs" });

    const call = calls[0];
    assert(call !== undefined);
    assertEquals(call.route, "plan_generate");
    const content = call.userContent;
    assertStringIncludes(content, "Oats, rolled");
    assertStringIncludes(content, "plenty of eggs");
    for (const leaked of [/allerg/i, /peanut/i, /kcal/i, /protein/i, /00000000-0000/, /target/i]) {
      assertFalse(leaked.test(content), `the prompt matched ${leaked}`);
    }
    for (const leaked of [/allerg/i, /peanut/i, /00000000-0000/]) {
      assertFalse(leaked.test(call.system), `the system prompt matched ${leaked}`);
    }
  },
);

Deno.test("an id the model was not offered is dropped, and the plan is still made", async () => {
  const { generation } = scriptedGeneration([{ ranking: ["zz9", "f1", "f1", "r2"] }]);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  const result = await executeTool(ctx, "plan_meals", input);

  assertEquals(result.status, "ok");
  assertEquals(saved.length, 1);
  assertEquals((saved[0]?.plan["rules"] as { ranking: string[] }).ranking.length, 2);
});

Deno.test("a quantity in the answer makes it no answer, and nothing is saved", async () => {
  const { generation } = scriptedGeneration([{ ranking: ["r1"], grams: 500 }]);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  const result = await executeTool(ctx, "plan_meals", input);

  assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
    planned: false,
    reason: "generation_failed",
  });
  assertEquals(saved.length, 0);
});

Deno.test(
  "a refusal, a timeout and an unreachable planner each give an honest result and save nothing",
  async () => {
    const words = {
      generation_refused: "The planner declined that request, so no plan was made.",
      generation_timeout: "Planning took too long, so no plan was made. Try again.",
      generation_failed:
        "The planner could not be reached, so no plan was made. Try again in a moment.",
    } as const;
    for (const [code, message] of Object.entries(words)) {
      const { generation } = scriptedGeneration([{ failure: code }]);
      const { ctx, saved, store } = planContext(planMealsTool, { generation });

      const result = await executeTool(ctx, "plan_meals", input);

      assertEquals(result.status, "ok");
      assertEquals(payloadOf(result), { planned: false, reason: code, message });
      assertEquals(saved.length, 0);
      assertEquals(structuredOf(result), {});
      assertEquals(store.actions.length, 0);
    }
  },
);

Deno.test("with no calorie target no plan is made, and the model is not called", async () => {
  const { generation, calls } = scriptedGeneration([ranking]);
  const { ctx, saved } = planContext(planMealsTool, {
    generation,
    profile: { target_kcal: null },
  });

  const result = await executeTool(ctx, "plan_meals", input);

  assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
    planned: false,
    reason: "no_calorie_target",
  });
  assertEquals(calls.length, 0);
  assertEquals(saved.length, 0);
});

Deno.test("with nothing to plan from no plan is made, and the model is not called", async () => {
  const { generation, calls } = scriptedGeneration([ranking]);
  const { ctx } = planContext(planMealsTool, {
    generation,
    tables: { recipes: [], palate_food_stats: [], palate_logged_days: [{ logged_days: 0 }] },
  });

  const result = await executeTool(ctx, "plan_meals", input);

  assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
    planned: false,
    reason: "nothing_to_plan_from",
  });
  assertEquals(calls.length, 0);
});

Deno.test(
  "a start date in the past is an invalid input, with no call and nothing saved",
  async () => {
    const { generation, calls } = scriptedGeneration([ranking]);
    const { ctx, saved } = planContext(planMealsTool, { generation });

    const result = await executeTool(ctx, "plan_meals", { ...input, start_date: "2026-11-10" });

    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["start_date"] });
    assertEquals(calls.length, 0);
    assertEquals(saved.length, 0);
  },
);

Deno.test("days asked for are planned, from the start date given", async () => {
  const { generation } = scriptedGeneration([ranking]);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  await executeTool(ctx, "plan_meals", { ...input, start_date: "2026-11-18", days: 3 });

  assertEquals(
    (saved[0]?.days as { local_date: string }[]).map(({ local_date }) => local_date),
    ["2026-11-18", "2026-11-19", "2026-11-20"],
  );
});

Deno.test("Undo archives the plan, once, and is unavailable after a day is confirmed", async () => {
  const { generation } = scriptedGeneration([ranking, ranking]);
  const { ctx, stub, store } = planContext(planMealsTool, { generation });
  const made = await executeTool(ctx, "plan_meals", input);
  assert(made.status === "ok" && made.actionId !== null);
  const [action] = store.actions;
  assertEquals(action?.tool, "plan_meals");
  assertEquals(action?.targetTable, "meal_plans");

  const first = await undoAction(ctx, made.actionId);
  const second = await undoAction(ctx, made.actionId);

  assertEquals(first, { status: "undone", actionId: made.actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assert(typeof stub.tables["meal_plans"]?.[0]?.["archived_at"] === "string");

  const confirmed = planContext(planMealsTool, { generation });
  const again = await executeTool(confirmed.ctx, "plan_meals", input);
  assert(again.status === "ok" && again.actionId !== null);
  const days = confirmed.stub.tables["meal_plans"]?.[0]?.["meal_plan_days"] as Record<
    string,
    unknown
  >[];
  Object.assign(days[0] ?? {}, {
    confirmed_at: "2026-11-16T12:00:00+00:00",
    confirmed_entry_ids: [],
  });

  const refused = await undoAction(confirmed.ctx, again.actionId);

  assertEquals(refused, { status: "error", code: "undo_unavailable" });
  assertEquals(confirmed.stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
});

Deno.test(
  "a context with no generation service answers tool_failed and saves nothing",
  async () => {
    const { ctx, saved } = planContext(planMealsTool);

    const result = await executeTool(ctx, "plan_meals", input);

    assertEquals(result.status, "error");
    assertEquals(saved.length, 0);
  },
);
