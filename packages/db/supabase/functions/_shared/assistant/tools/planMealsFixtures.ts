// The kitchen, targets and generation stand-ins the `plan_meals` tests share. Nothing in production imports this.
// Every name and figure is invented, and the ids are ours.
import { createFakeContext, userId } from "../testing.ts";
import { foodRow } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { GenerationFailure, GenerationRequest, GenerationServices } from "../generate.ts";
import type { ToolContext } from "../tool.ts";
import type { RpcHandler } from "./writeStub.ts";

const idOf = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const oatsId = idOf(11);
const bananaId = idOf(12);
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

// `save_meal_plan` as the database runs it: the plan and its days are stored together and the id is answered. The
// arguments are kept, so a test can read what was saved.
export type SavedPlan = { plan: Record<string, unknown>; days: unknown[]; items: unknown[] };

export function saveMealPlanRpc(saved: SavedPlan[]): RpcHandler {
  return (args, tables) => {
    const planId = idOf(900 + saved.length);
    const plan = args["p_plan"] as Record<string, unknown>;
    const days = args["p_days"] as { local_date: string; target: unknown }[];
    saved.push({ plan, days, items: args["p_items"] as unknown[] });
    tables["meal_plans"] = [
      ...(tables["meal_plans"] ?? []),
      {
        id: planId,
        ...plan,
        archived_at: null,
        created_at: "2026-11-03T09:00:00+00:00",
        meal_plan_days: days.map((day, at) => ({
          id: idOf(950 + at),
          local_date: day.local_date,
          target: day.target,
          confirmed_at: null,
          confirmed_entry_ids: null,
          meal_plan_items: [],
        })),
      },
    ];
    return { data: planId, error: null };
  };
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
  } = {},
) {
  const saved: SavedPlan[] = [];
  const stub = writeStub(
    { ...kitchenTables(options.profile), ...options.tables },
    { callerUserId: userId, rpc: { save_meal_plan: saveMealPlanRpc(saved) } },
  );
  const made = createFakeContext([tool], { localDate: options.localDate ?? "2026-11-16" });
  const ctx: ToolContext = {
    ...made.ctx,
    caller: stub.caller,
    ...(options.generation === undefined ? {} : { generation: options.generation }),
  };
  return { ...made, ctx, stub, saved };
}
