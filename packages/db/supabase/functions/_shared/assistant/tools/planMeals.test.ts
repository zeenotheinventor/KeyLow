import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { executeTool } from "../executor.ts";
import { userId } from "../testing.ts";
import { undoAction } from "../undo.ts";
import { toJsonSchema } from "../tool.ts";
import { planMealsTool } from "./planMeals.ts";
import {
  bananaId as bananaFood,
  crowdedKitchenTables,
  oatsId as oatsFood,
  ownersByDate,
  peanutStewId,
  planContext,
  scriptedGeneration,
} from "./planMealsFixtures.ts";
import { payloadOf } from "./testing.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { StoredUndo } from "../store.ts";

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

type Row = Record<string, unknown>;
const livePlanDays = (tables: Record<string, Row[]>) =>
  (tables["meal_plans"] ?? []).flatMap((plan) => plan["meal_plan_days"] as Row[]);
const itemCounts = (tables: Record<string, Row[]>, planAt: number) =>
  Object.fromEntries(
    ((tables["meal_plans"]?.[planAt]?.["meal_plan_days"] ?? []) as Row[]).map((day) => [
      String(day["local_date"]),
      (day["meal_plan_items"] as Row[]).length,
    ]),
  );
// What the turn loop does with `structured.undo`: keeps it beside the action, for the inverse to read.
const keepUndo = (
  store: { previousValues: Map<string, StoredUndo> },
  result: Awaited<ReturnType<typeof executeTool>>,
) => {
  assert(result.status === "ok" && result.actionId !== null);
  const undo = structuredOf(result)["undo"] as StoredUndo;
  store.previousValues.set(result.actionId, undo);
};
const plannedDates = (saved: { days: unknown[] }) =>
  (saved.days as { local_date: string }[]).map(({ local_date }) => local_date);
const dates = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, at) => `2026-11-${from + at}`);

Deno.test("a second plan over some of the dates leaves one live owner for each date", async () => {
  const { generation } = scriptedGeneration([ranking]);
  const { ctx, stub, saved } = planContext(planMealsTool, { generation });
  await executeTool(ctx, "plan_meals", input);

  const second = await executeTool(ctx, "plan_meals", {
    ...input,
    start_date: "2026-11-18",
    days: 3,
  });

  assertEquals(second.status, "ok");
  assertEquals(plannedDates(saved[1] ?? { days: [] }), dates(18, 20));
  const [older, newer] = (stub.tables["meal_plans"] ?? []).map((plan) => String(plan["id"]));
  const owners = ownersByDate(stub.tables);
  for (const date of dates(16, 22)) {
    assertEquals(owners[date]?.length, 1, date);
  }
  assertEquals(
    dates(16, 22).map((date) => owners[date]?.[0]),
    [older, older, newer, newer, newer, older, older],
  );
  assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
});

Deno.test("a second plan that covers an older plan whole archives the older plan", async () => {
  const { generation } = scriptedGeneration([ranking]);
  const { ctx, stub } = planContext(planMealsTool, { generation });
  await executeTool(ctx, "plan_meals", input);

  await executeTool(ctx, "plan_meals", input);

  const [older, newer] = (stub.tables["meal_plans"] ?? []).map((plan) => String(plan["id"]));
  assert(typeof stub.tables["meal_plans"]?.[0]?.["archived_at"] === "string");
  assertEquals(stub.tables["meal_plans"]?.[1]?.["archived_at"], null);
  assertEquals(
    Object.values(ownersByDate(stub.tables))
      .flat()
      .every((owner) => owner === newer),
    true,
  );
  assert(older !== newer);
});

Deno.test(
  "a date confirmed in a live plan is never planned again, and the model is told",
  async () => {
    const { generation } = scriptedGeneration([ranking]);
    const { ctx, stub, saved } = planContext(planMealsTool, { generation });
    await executeTool(ctx, "plan_meals", input);
    Object.assign(livePlanDays(stub.tables)[0] ?? {}, {
      confirmed_at: "2026-11-16T12:00:00+00:00",
      confirmed_entry_ids: [],
    });

    const second = await executeTool(ctx, "plan_meals", input);

    assertEquals(plannedDates(saved[1] ?? { days: [] }), dates(17, 22));
    assertEquals((payloadOf(second) as { notes: string[] }).notes, [
      "Days already confirmed in the diary were left out of the plan.",
    ]);
    assertEquals(ownersByDate(stub.tables)["2026-11-16"]?.length, 1);
    assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
  },
);

Deno.test("when every date is confirmed no plan is made and the model is not called", async () => {
  const { generation, calls } = scriptedGeneration([ranking]);
  const { ctx, stub, saved } = planContext(planMealsTool, { generation });
  await executeTool(ctx, "plan_meals", { ...input, days: 2 });
  for (const day of livePlanDays(stub.tables)) {
    Object.assign(day, { confirmed_at: "2026-11-16T12:00:00+00:00", confirmed_entry_ids: [] });
  }

  const second = await executeTool(ctx, "plan_meals", { ...input, days: 2 });

  assertEquals(payloadOf(second), {
    planned: false,
    reason: "all_days_confirmed",
    message: "Every one of those days is already confirmed in the diary, so no plan was made.",
  });
  assertEquals(calls.length, 1);
  assertEquals(saved.length, 1);
});

Deno.test(
  "Undo of a plan that replaced an older one brings the older plan back as it was",
  async () => {
    const { generation } = scriptedGeneration([ranking]);
    const { ctx, stub, store } = planContext(planMealsTool, { generation });
    await executeTool(ctx, "plan_meals", input);
    const before = itemCounts(stub.tables, 0);
    const leftoversBefore = livePlanDays(stub.tables)
      .flatMap((day) => day["meal_plan_items"] as Row[])
      .filter((item) => item["leftover_of"] !== null).length;
    const second = await executeTool(ctx, "plan_meals", input);
    assert(second.status === "ok" && second.actionId !== null);
    keepUndo(store, second);
    assertEquals(
      Object.values(itemCounts(stub.tables, 0)).every((count) => count === 0),
      true,
    );

    const undone = await undoAction(ctx, second.actionId);

    assertEquals(undone, { status: "undone", actionId: second.actionId });
    assertEquals(itemCounts(stub.tables, 0), before);
    assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
    assert(typeof stub.tables["meal_plans"]?.[1]?.["archived_at"] === "string");
    const owners = ownersByDate(stub.tables);
    assertEquals(Object.keys(owners).length, 7);
    assertEquals(
      ((stub.tables["meal_plans"]?.[0]?.["meal_plan_days"] ?? []) as Row[])
        .flatMap((day) => day["meal_plan_items"] as Row[])
        .filter((item) => item["leftover_of"] !== null).length,
      leftoversBefore,
    );
  },
);

Deno.test("Undo of a partly overlapping plan puts back only the days it cleared", async () => {
  const { generation } = scriptedGeneration([ranking]);
  const { ctx, stub, store } = planContext(planMealsTool, { generation });
  await executeTool(ctx, "plan_meals", input);
  const before = itemCounts(stub.tables, 0);
  const second = await executeTool(ctx, "plan_meals", {
    ...input,
    start_date: "2026-11-18",
    days: 3,
  });
  assert(second.status === "ok" && second.actionId !== null);
  keepUndo(store, second);

  await undoAction(ctx, second.actionId);

  assertEquals(itemCounts(stub.tables, 0), before);
  assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
});

Deno.test(
  "Undo does not recreate an overlap: a day a later plan took over stays with it",
  async () => {
    const { generation } = scriptedGeneration([ranking]);
    const { ctx, stub, store, reported } = planContext(planMealsTool, { generation });
    await executeTool(ctx, "plan_meals", input);
    const second = await executeTool(ctx, "plan_meals", {
      ...input,
      start_date: "2026-11-18",
      days: 3,
    });
    keepUndo(store, second);
    await executeTool(ctx, "plan_meals", { ...input, start_date: "2026-11-19", days: 2 });
    const [planA, planB, planC] = (stub.tables["meal_plans"] ?? []).map((plan) =>
      String(plan["id"]),
    );
    assert(second.status === "ok" && second.actionId !== null);

    const undone = await undoAction(ctx, second.actionId);

    assertEquals(undone, { status: "undone", actionId: second.actionId });
    const owners = ownersByDate(stub.tables);
    for (const date of dates(16, 22)) {
      assertEquals(owners[date]?.length, 1, date);
    }
    assertEquals(
      dates(16, 22).map((date) => owners[date]?.[0]),
      [planA, planA, planA, planC, planC, planA, planA],
    );
    assert(planB !== undefined);
    assert(typeof stub.tables["meal_plans"]?.[1]?.["archived_at"] === "string");
    assertEquals(reported.length, 2);
  },
);

Deno.test(
  "Undo leaves a cleared day that was confirmed alone, reports it, and restores the others",
  async () => {
    const { generation } = scriptedGeneration([ranking]);
    const { ctx, stub, store, reported } = planContext(planMealsTool, { generation });
    await executeTool(ctx, "plan_meals", input);
    const before = itemCounts(stub.tables, 0);
    const second = await executeTool(ctx, "plan_meals", input);
    keepUndo(store, second);
    assert(second.status === "ok" && second.actionId !== null);
    const confirmedDay = (stub.tables["meal_plans"]?.[0]?.["meal_plan_days"] as Row[])[1];
    Object.assign(confirmedDay ?? {}, {
      confirmed_at: "2026-11-17T12:00:00+00:00",
      confirmed_entry_ids: ["00000000-0000-4000-8000-0000000000e1"],
    });

    const undone = await undoAction(ctx, second.actionId);

    assertEquals(undone, { status: "undone", actionId: second.actionId });
    assertEquals(confirmedDay?.["confirmed_entry_ids"], ["00000000-0000-4000-8000-0000000000e1"]);
    assertEquals((confirmedDay?.["meal_plan_items"] as Row[]).length, 0);
    assertEquals(reported.length, 1);
    assertEquals(itemCounts(stub.tables, 0), { ...before, "2026-11-17": 0 });
    assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
  },
);

Deno.test(
  "a clean-up that fails is reported in the result, and the new plan still stands",
  async () => {
    const { generation } = scriptedGeneration([ranking]);
    let failing = false;
    const { ctx, stub, saved, reported } = planContext(planMealsTool, {
      generation,
      replaceFails: () => failing,
    });
    await executeTool(ctx, "plan_meals", input);
    failing = true;

    const second = await executeTool(ctx, "plan_meals", input);

    assertEquals(second.status, "ok");
    assertEquals(saved.length, 2);
    assertEquals((payloadOf(second) as { planned: boolean }).planned, true);
    assertEquals((payloadOf(second) as { notes: string[] }).notes, [
      "Some older planned days could not be cleared, so they may still show beside this plan.",
    ]);
    assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
    assert(reported.length > 0);
  },
);

Deno.test("Undo cannot reach a plan owned by another user", async () => {
  const { generation } = scriptedGeneration([ranking]);
  const otherPlan = "00000000-0000-4000-8000-0000000009ff";
  const { ctx, stub, store } = planContext(planMealsTool, {
    generation,
    tables: {
      meal_plans: [
        {
          id: otherPlan,
          user_id: "00000000-0000-4000-8000-0000000000b2",
          start_date: "2026-11-16",
          day_count: 1,
          rules: {},
          source: "assistant",
          archived_at: null,
          created_at: "2026-11-03T09:00:00+00:00",
          meal_plan_days: [],
        },
      ],
    },
  });
  store.actions.push({
    id: "action-theirs",
    userId,
    conversationId: ctx.turn.conversationId,
    turnId: ctx.turn.id,
    turnSeq: 1,
    tool: "plan_meals",
    targetTable: "meal_plans",
    targetId: otherPlan,
    targetIds: null,
    targetLocalDate: null,
    targetUpdatedAt: null,
    undoneAt: null,
  });

  const result = await undoAction(ctx, "action-theirs");

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(stub.tables["meal_plans"]?.[0]?.["archived_at"], null);
});

Deno.test("with wishes only the ranked items are planned", async () => {
  const { generation } = scriptedGeneration([{ ranking: ["f1", "f5", "f6"] }]);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  const result = await executeTool(ctx, "plan_meals", { ...input, request: "simple food" });

  assertEquals(result.status, "ok");
  assertFalse("wishes_not_fully_kept" in (payloadOf(result) as object));
  const foods = new Set(
    (saved[0]?.items as { food_id?: string; recipe_id?: string }[]).map(
      (item) => item.food_id ?? item.recipe_id,
    ),
  );
  assertEquals(foods.size <= 3, true);
  assertEquals(foods.has(undefined), false);
});

Deno.test("with no wishes a ranking only reorders, and every item may still be used", async () => {
  const { generation } = scriptedGeneration([{ ranking: ["f1"] }]);
  const { ctx, saved } = planContext(planMealsTool, { generation });

  await executeTool(ctx, "plan_meals", input);

  const ids = new Set(
    (saved[0]?.items as { food_id?: string; recipe_id?: string }[]).map(
      (item) => item.food_id ?? item.recipe_id,
    ),
  );
  assertEquals(ids.size > 1, true);
});

Deno.test(
  "when the ranked items place nothing the whole pool is used, and the result says so",
  async () => {
    // Oats have a usual amount of 0 g, which the planner cannot place, so wishes that rank only the oats place
    // nothing at all. The bananas can be placed.
    const statOf = (food: string, grams: number) => ({
      food_id: food,
      recipe_id: null,
      entry_count: 8,
      distinct_days: 8,
      first_local_date: "2026-10-01",
      last_local_date: "2026-11-02",
      median_resolved_grams: grams,
      before_eleven_count: 8,
      eleven_to_sixteen_count: 0,
      sixteen_or_later_count: 0,
    });
    const { generation, calls } = scriptedGeneration([{ ranking: ["f2"] }]);
    const { ctx, saved } = planContext(planMealsTool, {
      generation,
      tables: {
        recipes: [],
        palate_food_stats: [statOf(oatsFood, 0), statOf(bananaFood, 90)],
      },
    });

    const result = await executeTool(ctx, "plan_meals", { ...input, request: "just oats" });

    assertEquals(result.status, "ok");
    assertStringIncludes(calls[0]?.userContent ?? "", "Oats");
    assertEquals(
      (payloadOf(result) as { wishes_not_fully_kept: boolean }).wishes_not_fully_kept,
      true,
    );
    assertEquals(saved.length, 1);
    assertEquals(
      (saved[0]?.items as { food_id: string }[]).every((item) => item.food_id === bananaFood),
      true,
    );
  },
);

const shortDays = (result: Awaited<ReturnType<typeof executeTool>>) =>
  (
    payloadOf(result) as {
      days: { status: string; short_of: { not_fully_worked_out: boolean }[] }[];
    }
  ).days.filter(({ status }) => status === "short");

const unreachableTargets = {
  target_kcal: 1500,
  target_protein_g: 100,
  target_carbs_g: 300,
  target_fat_g: 10,
};

Deno.test(
  "a day the planner proved out of reach is short, and the card says by how much",
  async () => {
    const { generation } = scriptedGeneration([{ ranking: [] }]);
    const { ctx } = planContext(planMealsTool, {
      generation,
      profile: unreachableTargets,
      tables: crowdedKitchenTables(4, 2),
    });

    const result = await executeTool(ctx, "plan_meals", {
      ...input,
      named_macros: ["carbs_g", "fat_g"],
    });

    const short = shortDays(result);
    assertEquals(short.length, 7);
    const flags = short.flatMap(({ short_of }) =>
      short_of.map((miss) => miss.not_fully_worked_out),
    );
    assertEquals(flags.length > 0 && flags.every((flag) => !flag), true);
    const note = (structuredOf(result)["card"] as { note: string }).note;
    assertStringIncludes(note, "Mon 16 Nov is ");
    assertFalse(note.includes("was not fully worked out"));
  },
);

Deno.test("a day the planner ran out of work on is short with its own words", async () => {
  const { generation } = scriptedGeneration([{ ranking: [] }]);
  const { ctx } = planContext(planMealsTool, {
    generation,
    profile: unreachableTargets,
    tables: crowdedKitchenTables(20, 20),
  });

  const result = await executeTool(ctx, "plan_meals", {
    ...input,
    max_repeats: 0,
    named_macros: ["carbs_g", "fat_g"],
  });

  const flags = shortDays(result).flatMap(({ short_of }) =>
    short_of.map((miss) => miss.not_fully_worked_out),
  );
  assertEquals(flags.includes(true), true);
  const note = (structuredOf(result)["card"] as { note: string }).note;
  assertStringIncludes(note, "was not fully worked out");
  assertStringIncludes(note, "Ask me to replan it.");
  assertFalse(/closest the plan gets/i.test(note));
});
