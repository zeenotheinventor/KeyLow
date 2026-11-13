// The kitchen, targets and generation stand-ins the `plan_meals` tests share. Nothing in production imports this.
// Every name and figure is invented, and the ids are ours.
import { createFakeContext, userId } from "../testing.ts";
import { foodRow } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { GenerationFailure, GenerationRequest, GenerationServices } from "../generate.ts";
import type { ToolContext } from "../tool.ts";
import type { RpcHandler } from "./writeStub.ts";

const idOf = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

export const oatsId = idOf(11);
export const bananaId = idOf(12);
const chickenId = idOf(13);
const riceId = idOf(14);
const broccoliId = idOf(15);
const yogurtId = idOf(16);
const eggId = idOf(17);
const peanutsId = idOf(18);
const porridgeId = idOf(21);
const chickenRiceId = idOf(22);
export const peanutStewId = idOf(23);

const food = (
  id: string,
  name: string,
  kcal: number,
  protein_g: number,
  fat_g: number,
  carbs_g: number,
) =>
  foodRow({
    id,
    name,
    kcal,
    protein_g,
    fat_g,
    carbs_g,
    fibre_g: 2,
    source: "cofid",
    owner_id: null,
  });

const foods = [
  food(oatsId, "Oats, rolled", 381, 10.9, 8.1, 70.7),
  food(bananaId, "Bananas, flesh only", 81, 1.2, 0.1, 20.3),
  food(chickenId, "Chicken, breast, grilled", 148, 32, 2.2, 0),
  food(riceId, "Rice, white, boiled", 131, 2.8, 0.4, 31.1),
  food(broccoliId, "Broccoli, boiled", 28, 3.3, 0.5, 2.8),
  food(yogurtId, "Yogurt, Greek style", 133, 5.7, 10.2, 4.8),
  food(eggId, "Eggs, whole, boiled", 143, 14.1, 9.6, 0),
  food(peanutsId, "Peanuts, roasted", 589, 25, 50, 8),
];

const computed = (kcal: number, protein_g: number, servings: number, grams: number) => {
  const per = { kcal, protein_g, fat_g: 10, carbs_g: 40, fibre_g: 4 };
  const total = Object.fromEntries(
    Object.entries(per).map(([key, value]) => [key, value * servings]),
  );
  return {
    total,
    perServing: per,
    per100g: per,
    totalGrams: grams,
    effectiveGrams: grams,
    servingsOnly: false,
    engineVersion: 1,
  };
};

const recipe = (
  id: string,
  name: string,
  servings: number,
  grams: number,
  kcal: number,
  protein_g: number,
) => ({
  id,
  owner_id: userId,
  name,
  servings,
  yield_grams: grams,
  is_archived: false,
  computed: computed(kcal, protein_g, servings, grams),
});

const stat = (
  id: { food?: string; recipe?: string },
  counts: [number, number, number],
  grams: number,
) => ({
  food_id: id.food ?? null,
  recipe_id: id.recipe ?? null,
  entry_count: 8,
  distinct_days: 8,
  first_local_date: "2026-10-01",
  last_local_date: "2026-11-02",
  median_resolved_grams: grams,
  before_eleven_count: counts[0],
  eleven_to_sixteen_count: counts[1],
  sixteen_or_later_count: counts[2],
});

export const kitchenTables = (profile: Record<string, unknown> = {}) => ({
  foods,
  recipes: [
    recipe(porridgeId, "Test porridge bowl", 1, 340, 389, 13),
    recipe(chickenRiceId, "Test chicken and rice", 2, 700, 518, 49),
  ],
  palate_logged_days: [{ logged_days: 10 }],
  palate_food_stats: [
    stat({ food: oatsId }, [8, 0, 0], 40),
    stat({ food: bananaId }, [8, 0, 0], 90),
    stat({ food: eggId }, [6, 2, 0], 120),
    stat({ food: yogurtId }, [6, 2, 0], 150),
    stat({ food: chickenId }, [0, 4, 4], 130),
    stat({ food: riceId }, [0, 4, 4], 180),
    stat({ food: broccoliId }, [0, 4, 4], 80),
    stat({ recipe: porridgeId }, [8, 0, 0], 340),
    stat({ recipe: chickenRiceId }, [0, 3, 5], 350),
  ],
  palate_preferences: [],
  programs: [],
  targets: [],
  profiles: [
    {
      id: userId,
      timezone: "Europe/London",
      target_kcal: 1300,
      target_protein_g: 90,
      target_carbs_g: 150,
      target_fat_g: 50,
      targets_updated_at: "2026-10-22T08:00:00+00:00",
      meal_plan_repeat_limit: null,
      ...profile,
    },
  ],
  meal_plans: [],
});

// The plan tables as the database holds them, in the shape `listMealPlans` reads. `save_meal_plan` and
// `replace_meal_plan_day` write them, as the functions do: a plan and its days together, and a day's items
// replaced as a whole, refusing a confirmed day. The arguments are kept, so a test can read what was saved.
export type SavedPlan = { plan: Record<string, unknown>; days: unknown[]; items: unknown[] };

type Row = Record<string, unknown>;

const itemRowOf = (item: Row, at: number, ids: { next: () => string }): Row => ({
  id: ids.next(),
  position: item["position"],
  slot_time: item["slot_time"] ?? null,
  item_type: item["item_type"],
  food_id: item["food_id"] ?? null,
  recipe_id: item["recipe_id"] ?? null,
  servings: item["servings"] ?? null,
  grams: item["grams"] ?? null,
  portion_id: item["portion_id"] ?? null,
  nutrients: item["nutrients"],
  leftover_of: null,
  snapshot: item["snapshot"],
  // Where the item sat in the call, so a leftover can be pointed at its cook.
  at,
  leftover_of_position: item["leftover_of_position"] ?? null,
  leftover_of_day: item["leftover_of_day"] ?? null,
});

// The items as the table keeps them, with each leftover pointing at the item that cooked it, found by day and
// position in the plan, as the function finds it.
function withCooks(items: Row[], planDays: Row[], ownDate: string): Row[] {
  return items.map((item) => {
    const position = item["leftover_of_position"];
    if (position === null) {
      return item;
    }
    const date = item["leftover_of_day"] ?? ownDate;
    const cookDay = planDays.find((day) => day["local_date"] === date);
    const cook = (cookDay?.["meal_plan_items"] as Row[] | undefined)?.find(
      (candidate) => candidate["position"] === position,
    );
    return { ...item, leftover_of: cook?.["id"] ?? null };
  });
}

let nextRowNumber = 1000;
const ids = { next: () => idOf(nextRowNumber++) };

export function saveMealPlanRpc(saved: SavedPlan[]): RpcHandler {
  return (args, tables) => {
    const planId = ids.next();
    const plan = args["p_plan"] as Row;
    const days = args["p_days"] as Row[];
    const items = args["p_items"] as Row[];
    saved.push({ plan, days, items });
    const planDays: Row[] = days.map((day) => ({
      id: ids.next(),
      local_date: day["local_date"],
      target: day["target"],
      confirmed_at: null,
      confirmed_entry_ids: null,
      meal_plan_items: [],
    }));
    // The cooks first, then the leftovers that point at them, as the function inserts them.
    for (const pass of ["cooks", "leftovers"]) {
      for (const day of planDays) {
        const rows = items
          .filter((item) => item["local_date"] === day["local_date"])
          .filter((item) => (item["leftover_of_position"] === undefined) === (pass === "cooks"))
          .map((item, at) =>
            itemRowOf(
              { ...item, leftover_of_position: item["leftover_of_position"] ?? null },
              at,
              ids,
            ),
          );
        day["meal_plan_items"] = [
          ...(day["meal_plan_items"] as Row[]),
          ...withCooks(rows, planDays, String(day["local_date"])),
        ];
      }
    }
    tables["meal_plans"] = [
      ...(tables["meal_plans"] ?? []),
      {
        id: planId,
        ...plan,
        archived_at: null,
        created_at: "2026-11-03T09:00:00+00:00",
        meal_plan_days: planDays,
      },
    ];
    return { data: planId, error: null };
  };
}

// `replace_meal_plan_day`: the day's items become exactly the ones given. A confirmed day is refused with 22023.
// `fails` makes the call fail, as a day the database could not write.
export function replaceMealPlanDayRpc(options: { fails?: () => boolean } = {}): RpcHandler {
  return (args, tables) => {
    if (options.fails?.() === true) {
      return { data: null, error: { code: "XX000", message: "unavailable" } };
    }
    for (const plan of tables["meal_plans"] ?? []) {
      const planDays = plan["meal_plan_days"] as Row[];
      const day = planDays.find((candidate) => candidate["id"] === args["p_day_id"]);
      if (day === undefined) {
        continue;
      }
      if (day["confirmed_at"] !== null) {
        return {
          data: null,
          error: { code: "22023", message: "a confirmed day cannot be replaced" },
        };
      }
      const given = args["p_items"] as Row[];
      const rows = given.map((item, at) => itemRowOf(item, at, ids));
      day["meal_plan_items"] = withCooks(rows, planDays, String(day["local_date"]));
      return { data: null, error: null };
    }
    return { data: null, error: { code: "22023", message: "the day was not found" } };
  };
}

// The live plans' days that hold something on each date, which is who owns the date.
export function ownersByDate(tables: Record<string, Row[]>): Record<string, string[]> {
  const owners: Record<string, string[]> = {};
  for (const plan of tables["meal_plans"] ?? []) {
    if (plan["archived_at"] !== null && plan["archived_at"] !== undefined) {
      continue;
    }
    for (const day of plan["meal_plan_days"] as Row[]) {
      if ((day["meal_plan_items"] as Row[]).length > 0) {
        const date = String(day["local_date"]);
        owners[date] = [...(owners[date] ?? []), String(plan["id"])];
      }
    }
  }
  return owners;
}

export type RankingCall = GenerationRequest<unknown>;

// A generation service that answers each call with the next reply and keeps what it was asked. The reply goes
// through the request's own `read`, as the real service does, so an answer outside the schema reads as failed.
type ScriptedFailure = { failure: GenerationFailure };

const failureOf = (reply: unknown): GenerationFailure | null => {
  if (typeof reply !== "object" || reply === null || !("failure" in reply)) {
    return null;
  }
  const { failure } = reply as ScriptedFailure;
  return failure;
};

export function scriptedGeneration(replies: unknown[]) {
  const calls: RankingCall[] = [];
  const generation: GenerationServices = {
    generate<Value>(request: GenerationRequest<Value>) {
      calls.push(request as GenerationRequest<unknown>);
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      const failure = failureOf(reply);
      if (failure !== null) {
        return Promise.resolve({ ok: false as const, code: failure });
      }
      const value = request.read(reply);
      return Promise.resolve(
        value === null
          ? { ok: false as const, code: "generation_failed" as const }
          : { ok: true as const, value, model: "claude-opus-5-5" },
      );
    },
  };
  return { generation, calls };
}

export function planContext(
  tool: Parameters<typeof createFakeContext>[0][number],
  options: {
    generation?: GenerationServices;
    profile?: Record<string, unknown>;
    tables?: Record<string, Record<string, unknown>[]>;
    localDate?: string;
    // Makes `replace_meal_plan_day` fail while this answers true.
    replaceFails?: () => boolean;
  } = {},
) {
  const saved: SavedPlan[] = [];
  const stub = writeStub(
    { ...kitchenTables(options.profile), ...options.tables },
    {
      callerUserId: userId,
      rpc: {
        save_meal_plan: saveMealPlanRpc(saved),
        replace_meal_plan_day: replaceMealPlanDayRpc(
          options.replaceFails === undefined ? {} : { fails: options.replaceFails },
        ),
      },
    },
  );
  const made = createFakeContext([tool], { localDate: options.localDate ?? "2026-11-16" });
  const ctx: ToolContext = {
    ...made.ctx,
    caller: stub.caller,
    ...(options.generation === undefined ? {} : { generation: options.generation }),
  };
  return { ...made, ctx, stub, saved };
}

// A kitchen of generated foods and recipes, each usual at every time of day, with calories, protein, carbs and fat
// that add up, so four named targets are all in play and a plan spends the planner's work budget.
export function crowdedKitchenTables(foodCount: number, recipeCount: number) {
  const mixed = (kcal: number, protein_g: number) => ({
    kcal,
    protein_g,
    fat_g: (kcal * 0.3) / 9,
    carbs_g: (kcal * 0.45) / 4,
    fibre_g: 0,
  });
  const foodIds = Array.from({ length: foodCount }, (_, at) => idOf(3000 + at));
  const recipeIds = Array.from({ length: recipeCount }, (_, at) => idOf(4000 + at));
  return {
    foods: foodIds.map((id, at) => {
      const figures = mixed(40 + ((at * 37) % 400), 1 + ((at * 7) % 30));
      return food(
        id,
        `Crowded food ${at}`,
        figures.kcal,
        figures.protein_g,
        figures.fat_g,
        figures.carbs_g,
      );
    }),
    recipes: recipeIds.map((id, at) => {
      const perServing = mixed(300 + ((at * 53) % 500), 15 + ((at * 11) % 40));
      const servings = 1 + (at % 4);
      return {
        id,
        owner_id: userId,
        name: `Crowded recipe ${at}`,
        servings,
        yield_grams: servings * 300,
        is_archived: false,
        computed: {
          total: perServing,
          perServing,
          per100g: perServing,
          totalGrams: servings * 300,
          effectiveGrams: servings * 300,
          servingsOnly: false,
          engineVersion: 1,
        },
      };
    }),
    palate_food_stats: [
      ...foodIds.map((id) => stat({ food: id }, [3, 3, 3], 100)),
      ...recipeIds.map((id) => stat({ recipe: id }, [3, 3, 3], 300)),
    ],
  };
}
