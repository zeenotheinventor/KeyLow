import { getRecipe, listMealPlans, listRecipes, saveMealPlan } from "@keylow/api-client";
import { planMeals, planSaveInput } from "@keylow/core/plans";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import {
  confirmedDayWroteTheRightEntries,
  daysMeetTheirTargets,
  planSaved,
  shoppingListMatchesCore,
} from "../../cases/mealPlanGraders.ts";
import {
  everyKitchenRouteNeedsConsent,
  everyKitchenToolRefusedOffTheAllowlist,
  foreignKitchenRowsUnreachableDirectly,
  userBKitchenUnchanged,
} from "../../cases/redteamKitchenGraders.ts";
import { FIXTURE_FOODS } from "../../fixtures/diary.ts";
import { KITCHEN_FILLER_FOODS, KITCHEN_RECIPE_BANDS } from "../../fixtures/kitchen.ts";
import { kitchenWeek, perServingOf, per100Of } from "../../fixtures/kitchenFacts.ts";
import { present } from "../../fixtures/present.ts";
import { createRedTeamWorld } from "../../fixtures/redTeamWorld.ts";
import { createEvalDatabase } from "../../src/database.ts";
import { createFixtureUser, seededFoods } from "../../src/fixtureUser.ts";
import { jsonObjectOf } from "../../src/jsonObject.ts";
import { createKitchenWorld } from "../../src/kitchenWorld.ts";
import { createUndoTurn } from "../../src/undoTurn.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";
import type { KitchenWorld } from "../../src/kitchenWorld.ts";
import type { EvalDatabase, TurnResult } from "../../src/types.ts";
import type { Database } from "@keylow/api-client";
import type { PlanFoodCandidate, PlanRecipeCandidate } from "@keylow/core/plans";
import type { SupabaseClient } from "@supabase/supabase-js";

// The meal plan world (KEY-1038) against the local stack: a plan written the way `plan_meals` writes one (core's planner
// over the user's own recipes and foods, saved through `saveMealPlan`), the two buttons of the Plan screen pressed by the
// harness, and the graders that read the result back. Then the kitchen red-team world, whose direct calls go to the
// served `mcp` and `assistant` functions with no model. These users are new for the run, named key1038-<run id>-..., and
// afterAll removes them with every row by the cascade.
const RUN_ID = crypto.randomUUID().slice(0, 8);
const WRITING_TIMEOUT_MS = 180_000;
const DAYS = 3;

let userA: FixtureUser;
let userB: FixtureUser;
let serviceClient: SupabaseClient<Database>;
let kitchen: KitchenWorld;
let database: EvalDatabase;
let planId: string;

const turnOfPlan = (): TurnResult => ({
  conversationId: "conversation",
  turnId: "turn-of-the-plan",
  status: "complete",
  answer: "",
  toolCalls: [],
});

// The database as the graders see it, with the one action row the tool would have written for the plan.
const databaseWithPlanAction = (): EvalDatabase => ({
  ...database,
  readRows: (query) =>
    query.table === "assistant_actions"
      ? Promise.resolve([{ turn_id: "turn-of-the-plan", tool: "plan_meals", target_id: planId }])
      : database.readRows(query),
});

/** The plan `plan_meals` would write for the user's own recipes and foods, from today, saved through the repo. */
async function writePlan(): Promise<string> {
  const { client, anchorDate } = userA;
  const foodRows = await seededFoods(client);
  const recipeRows = await listRecipes(client);
  const recipes = new Map(
    await Promise.all(
      recipeRows.map(async ({ id }) => {
        const recipe = await getRecipe(client, id);
        if (recipe === null) {
          throw new Error("The eval user cannot read a recipe it wrote");
        }
        return [id, recipe] as const;
      }),
    ),
  );
  const candidates: PlanRecipeCandidate[] = recipeRows.map(({ id, name, servings }) => ({
    id,
    perServing: perServingOf(name),
    servings,
    bands: present(KITCHEN_RECIPE_BANDS[name], name),
  }));
  const foodCandidates: PlanFoodCandidate[] = FIXTURE_FOODS.flatMap((key) => {
    const filler = KITCHEN_FILLER_FOODS[key];
    const food = foodRows.get(key);
    return filler === undefined || food === undefined
      ? []
      : [{ id: food.id, per100: per100Of(key), ...filler }];
  });
  const ranking = [...candidates]
    .sort((left, right) => (right.perServing.protein_g ?? 0) - (left.perServing.protein_g ?? 0))
    .map(({ id }) => id);
  const rules = {
    maxRepeats: 2,
    leftovers: true,
    slots: ["morning", "midday", "evening"],
  } as const;
  const plan = planMeals({
    recipes: candidates,
    foods: foodCandidates,
    ranking,
    rules,
    days: kitchenWeek(anchorDate).slice(0, DAYS),
  });
  const saved = planSaveInput({
    plan,
    rules: { ...rules, ranking },
    foods: new Map([...foodRows.values()].map((food) => [food.id, food])),
    recipes,
  });
  return saveMealPlan(client, {
    startDate: saved.startDate,
    source: saved.source,
    rules: jsonObjectOf(saved.rules),
    days: saved.days.map(({ localDate, target }) => ({ localDate, target: jsonObjectOf(target) })),
    items: saved.items.map((item) => ({
      ...item,
      nutrients: jsonObjectOf(item.nutrients),
      snapshot: jsonObjectOf(item.snapshot),
    })),
  });
}

beforeAll(async () => {
  const stack = inject("stack");
  userA = await createFixtureUser(stack, { namePrefix: `key1038-${RUN_ID}-a` });
  userB = await createFixtureUser(stack, { namePrefix: `key1038-${RUN_ID}-b` });
  serviceClient = createClient<Database>(stack.apiUrl, stack.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  kitchen = createKitchenWorld(userA, serviceClient);
  database = createEvalDatabase(userA.client);
  await kitchen.ensureWorld();
  planId = await writePlan();
}, WRITING_TIMEOUT_MS);

afterAll(async () => {
  await Promise.all([userA, userB].map((user) => user.remove().catch(() => undefined)));
});

const turns = [turnOfPlan()];
const grade = (grader: ReturnType<typeof planSaved>) =>
  grader({ turns, database: databaseWithPlanAction() });

describe("the plan written for the eval user", () => {
  it("should be a live plan of three days that the graders find through its action row", async () => {
    expect((await kitchen.livePlans()).map(({ id }) => id)).toEqual([planId]);
    expect((await grade(planSaved(() => kitchen, 0, DAYS))).passed).toBe(true);
  });

  it("should meet each day's target for its weekday, or be short as core finds it", async () => {
    const outcome = await grade(daysMeetTheirTargets(() => kitchen, 0));

    // The tool's own report of a short day is not here, so only a plan with no short day passes. The fixtures say it has none.
    expect(outcome.reason).toContain("3 days within the tolerance");
    expect(outcome.passed).toBe(true);
  });
});

describe("Add to shopping list", () => {
  it("should write the foods core sums for the plan, once each, and clearPlanning should empty the list", async () => {
    const [plan] = await kitchen.livePlans();
    const last = plan?.days.at(-1);
    const scope = { start: plan?.startDate ?? "", end: last?.localDate ?? "" };

    await kitchen.addPlanToList(scope);

    expect((await kitchen.expectedShopping(scope)).size).toBeGreaterThan(0);
    expect((await grade(shoppingListMatchesCore(() => kitchen, 0))).passed).toBe(true);

    await kitchen.clearPlanning();

    expect(await kitchen.shoppingList()).toEqual([]);
    expect(await listMealPlans(userA.client)).toEqual([]);
  });
});

describe("Confirm day", () => {
  it("should write one entry for each planned item, with the planned figures, and clearPlanning should remove them", async () => {
    planId = await writePlan();
    const [plan] = await kitchen.livePlans();
    const first = plan?.days[0];
    const entriesBefore = await liveEntriesOn(first?.localDate ?? "");

    const written = await kitchen.confirmDay(first?.id ?? "");

    expect(written).toHaveLength(first?.items.length ?? -1);
    expect((await liveEntriesOn(first?.localDate ?? "")) - entriesBefore).toBe(written.length);
    const outcome = await grade(confirmedDayWroteTheRightEntries(() => kitchen, 0));
    expect(outcome.reason).toContain(`${written.length} entries`);
    expect(outcome.passed).toBe(true);

    await kitchen.clearPlanning();

    expect(await liveEntriesOn(first?.localDate ?? "")).toBe(entriesBefore);
    expect(await listMealPlans(userA.client)).toEqual([]);
  });

  async function liveEntriesOn(localDate: string): Promise<number> {
    const { count, error } = await userA.client
      .from("food_log_entries")
      .select("*", { count: "exact", head: true })
      .eq("local_date", localDate)
      .is("deleted_at", null);
    if (error) {
      throw new Error(`Could not count the entries (${error.code})`);
    }
    return count ?? 0;
  }
});

describe("the kitchen red-team world", () => {
  let world: Awaited<ReturnType<typeof createRedTeamWorld>>;
  let functionsServed = false;
  const worlds = () => ({ redTeam: () => world, kitchen: () => kitchen });

  beforeAll(async () => {
    world = await createRedTeamWorld({
      stack: inject("stack"),
      userA,
      userB,
      serviceClient: adminClient(),
      undoTurn: createUndoTurn({ client: userA.client }),
    });
    // A stack with no served functions answers 503 (the worker does not boot). The direct calls need them, as those of
    // KEY-702 and KEY-912 do, so they are skipped on such a stack, with the reason said, and run where they are served.
    const probe = await world.kitchen.callAsA("get_day", {}, "get_day");
    functionsServed = probe.attempt.status !== 503;
    // The skip is for a local stack only. In CI the functions are served, so a 503 there is a failure.
    if (!functionsServed && process.env["CI"] !== undefined && process.env["CI"] !== "") {
      throw new Error(
        "The functions are not served on the CI stack (the mcp function answered 503)",
      );
    }
  }, WRITING_TIMEOUT_MS);

  it("should give B a recipe and a plan of its own that A cannot read, and leave them as they were", async () => {
    const rows = await world.kitchen.rowsOfB();

    expect((await listMealPlans(userB.client)).map(({ id }) => id)).toEqual([rows.planId]);
    expect(await getRecipe(userA.client, rows.recipeId)).toBeNull();
    if (functionsServed) {
      expect((await world.kitchen.readRecipesAsB()).body).toContain(rows.recipeName);
    }
    expect((await userBKitchenUnchanged(worlds())({ turns: [], database })).passed).toBe(true);
  });

  it("should refuse all five kitchen tools off the allowlist, as the functions do", async ({
    skip,
  }) => {
    skip(!functionsServed, "the functions are not served on this stack");
    const outcome = await everyKitchenToolRefusedOffTheAllowlist(worlds())({ turns: [], database });

    expect(outcome.reason).toBe("all 5 kitchen tools were refused off the allowlist");
    expect(outcome.passed).toBe(true);
  });

  it("should leave B's recipe and plan out of reach of A's direct calls", async ({ skip }) => {
    skip(!functionsServed, "the functions are not served on this stack");
    const outcome = await foreignKitchenRowsUnreachableDirectly(worlds())({ turns: [], database });

    expect(outcome.passed).toBe(true);
  });

  it("should refuse each kitchen route at the consent gate with no model call, and put the consent back", async ({
    skip,
  }) => {
    skip(!functionsServed, "the functions are not served on this stack");
    const outcome = await everyKitchenRouteNeedsConsent(worlds())({ turns: [], database });

    expect(outcome.passed).toBe(true);
    const { data, error } = await userA.client.from("profiles").select("assistant_consent_at");
    expect(error).toBeNull();
    expect(data?.[0]?.assistant_consent_at).not.toBeNull();
  });

  it("should plant A's injected recipes and foods once", async () => {
    await world.kitchen.ensureInjectionPlanted();
    await world.kitchen.ensureInjectionPlanted();

    const names = (await listRecipes(userA.client)).map(({ name }) => name);

    expect(names.filter((name) => name === world.kitchen.injection.recipeWrite)).toHaveLength(1);
    expect(names).toContain(world.kitchen.injection.recipeAllergen);
  });
});
