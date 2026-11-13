// The CPU of core's `planMeals` under Deno with the bundled core, on the two shapes of KEY-1031's acceptance: a
// realistic week of the eval kitchen, and the largest pool the tool offers (7 days, 30 recipes, 20 foods, four named targets).
// Run it with `deno bench --config supabase/functions/deno.json supabase/functions/_shared/assistant/planMeals.bench.ts`.
// It measures the planner alone, and an Edge Function's CPU also pays for the reads and the writes around it. All
// figures are invented.
import { planMeals } from "../core.ts";

type Per = { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fibre_g: number };
const per = (
  kcal: number,
  protein_g: number,
  fat_g: number,
  carbs_g: number,
  fibre_g: number,
): Per => ({
  kcal,
  protein_g,
  fat_g,
  carbs_g,
  fibre_g,
});

const BANDS = ["morning", "midday", "evening"] as const;
type Band = (typeof BANDS)[number];

const KITCHEN_FOODS: Record<string, [Per, number, Band[]]> = {
  oats: [per(381, 10.9, 8.1, 70.7, 7.8), 30, ["morning"]],
  banana: [per(81, 1.2, 0.1, 20.3, 1.4), 90, ["morning"]],
  egg: [per(143, 14.1, 9.6, 0, 0), 120, ["morning", "midday"]],
  bread: [per(207, 7.9, 2, 42.1, 5), 60, ["morning", "midday"]],
  yogurt: [per(133, 5.7, 10.2, 4.8, 0), 150, ["morning"]],
  apple: [per(51, 0.6, 0.5, 11.6, 1.2), 100, ["morning", "midday"]],
  chicken: [per(148, 32, 2.2, 0, 0), 130, ["midday", "evening"]],
  rice: [per(131, 2.8, 0.4, 31.1, 0.5), 180, ["midday", "evening"]],
  broccoli: [per(28, 3.3, 0.5, 2.8, 2.8), 80, ["midday", "evening"]],
  salmon: [per(239, 24.6, 15.6, 0, 0), 120, ["midday", "evening"]],
  potato: [per(74, 1.8, 0.1, 17.5, 1.6), 200, ["midday", "evening"]],
  oil: [per(899, 0, 99.9, 0, 0), 10, ["evening"]],
};

// The eight recipes of the eval kitchen, as ingredient grams, so their figures are the sums of the foods above.
const KITCHEN_RECIPES: {
  id: string;
  servings: number;
  bands: Band[];
  lines: [string, number][];
}[] = [
  {
    id: "porridge",
    servings: 1,
    bands: ["morning"],
    lines: [
      ["oats", 50],
      ["banana", 90],
    ],
  },
  {
    id: "chicken-rice",
    servings: 2,
    bands: ["midday", "evening"],
    lines: [
      ["chicken", 260],
      ["rice", 360],
      ["broccoli", 160],
      ["oil", 15],
    ],
  },
  {
    id: "yogurt-apple",
    servings: 1,
    bands: ["morning"],
    lines: [
      ["yogurt", 200],
      ["apple", 150],
      ["oats", 40],
    ],
  },
  {
    id: "egg-toast",
    servings: 1,
    bands: ["morning"],
    lines: [
      ["egg", 120],
      ["bread", 80],
      ["oil", 5],
    ],
  },
  {
    id: "salmon-potato",
    servings: 1,
    bands: ["midday"],
    lines: [
      ["salmon", 130],
      ["potato", 250],
      ["broccoli", 80],
    ],
  },
  {
    id: "chicken-egg",
    servings: 1,
    bands: ["midday"],
    lines: [
      ["chicken", 150],
      ["egg", 100],
      ["bread", 60],
      ["broccoli", 80],
    ],
  },
  {
    id: "chicken-bake",
    servings: 2,
    bands: ["evening"],
    lines: [
      ["chicken", 320],
      ["potato", 600],
      ["broccoli", 240],
      ["oil", 16],
    ],
  },
  {
    id: "salmon-rice",
    servings: 2,
    bands: ["evening"],
    lines: [
      ["salmon", 260],
      ["rice", 400],
      ["broccoli", 200],
      ["oil", 10],
    ],
  },
];

const perServingOf = (lines: [string, number][], servings: number): Per => {
  const total = per(0, 0, 0, 0, 0);
  for (const [food, grams] of lines) {
    const figures = KITCHEN_FOODS[food]?.[0];
    if (figures === undefined) {
      throw new Error("unknown fixture food");
    }
    for (const key of Object.keys(total) as (keyof Per)[]) {
      total[key] += (figures[key] * grams) / 100 / servings;
    }
  }
  return total;
};

const week = (target: Record<string, number>) =>
  Array.from({ length: 7 }, (_, offset) => ({ localDate: `2026-11-${16 + offset}`, target }));

const rules = { maxRepeats: 2, leftovers: true, slots: [...BANDS] };

const kitchen = {
  recipes: KITCHEN_RECIPES.map(({ id, servings, bands, lines }) => ({
    id,
    servings,
    bands,
    perServing: perServingOf(lines, servings),
  })),
  foods: Object.entries(KITCHEN_FOODS).map(([id, [per100, typicalGrams, bands]]) => ({
    id,
    per100,
    typicalGrams,
    bands,
  })),
  ranking: KITCHEN_RECIPES.map(({ id }) => id),
  rules,
  days: week({ kcal: 1300, protein_g: 90 }),
};

// Calories, protein, carbs and fat that add up, so four named targets are all in play.
const mixed = (kcal: number, protein_g: number): Per =>
  per(kcal, protein_g, (kcal * 0.3) / 9, (kcal * 0.45) / 4, 0);

// The largest pool `plan_meals` offers (`PLAN_POOL_LIMITS`), in the shape that was slowest in core's tests: every
// candidate in every band, ranked, no repeat limit, and four named targets the fits cannot meet.
const large = {
  recipes: Array.from({ length: 30 }, (_, at) => ({
    id: `recipe-${at}`,
    servings: 1 + (at % 4),
    bands: [...BANDS],
    perServing: mixed(300 + ((at * 53) % 500), 15 + ((at * 11) % 40)),
  })),
  foods: Array.from({ length: 20 }, (_, at) => ({
    id: `food-${at}`,
    per100: mixed(40 + ((at * 37) % 400), 1 + ((at * 7) % 30)),
    typicalGrams: 40 + ((at * 25) % 200),
    bands: [...BANDS],
  })),
  ranking: [
    ...Array.from({ length: 30 }, (_, at) => `recipe-${at}`),
    ...Array.from({ length: 20 }, (_, at) => `food-${at}`),
  ],
  rules: { ...rules, maxRepeats: null },
  days: week({ kcal: 1500, protein_g: 100, carbs_g: 300, fat_g: 10 }),
};

Deno.bench("planMeals, a realistic eval kitchen week", () => {
  planMeals(kitchen);
});

Deno.bench(
  "planMeals, the tool's largest pool (7 days, 30 recipes, 20 foods, four named targets)",
  () => {
    planMeals(large);
  },
);
