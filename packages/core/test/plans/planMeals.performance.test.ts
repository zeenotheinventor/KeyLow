import { describe, expect, it } from "vitest";

import { foodOf, recipeOf, RULES, weekOf } from "./pools";
import { planMeals } from "../../src/plans";

import type { PlanBand } from "../../src/plans";

// The Edge Function that runs the planner has about 2 s of CPU (M9 plan, section 5). A 7 day plan from about
// 50 candidates has to leave most of that to everything else, so it gets a tenth of it.
const BUDGET_MILLISECONDS = 200;
const HEAVY_BUDGET_MILLISECONDS = 800;

const BAND_SETS: readonly (readonly PlanBand[])[] = [
  ["morning"],
  ["midday", "evening"],
  ["morning", "midday"],
  ["evening"],
];

const candidates = () => {
  const foods = Array.from({ length: 30 }, (_, at) =>
    foodOf(
      `food-${at}`,
      40 + ((at * 37) % 400),
      1 + ((at * 7) % 30),
      40 + ((at * 25) % 200),
      BAND_SETS[at % 4],
    ),
  );
  const recipes = Array.from({ length: 20 }, (_, at) =>
    recipeOf(
      `recipe-${at}`,
      300 + ((at * 53) % 500),
      15 + ((at * 11) % 40),
      1 + (at % 4),
      BAND_SETS[at % 4],
    ),
  );
  return { foods, recipes, ranking: [...recipes, ...foods].map(({ id }) => id) };
};

describe("planMeals performance", () => {
  it(`should plan 7 days from 50 candidates in under ${BUDGET_MILLISECONDS} ms`, () => {
    const input = { ...candidates(), rules: { ...RULES, maxRepeats: null }, days: weekOf(7) };
    planMeals(input);

    const started = performance.now();
    planMeals(input);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(BUDGET_MILLISECONDS);
  });
});

// What is capped is the number of fitter calls one plan may make (`PLAN_FIT_BUDGET`), not the time. A plan that
// runs out of fits reports its remaining days short with the reason `work_limit`. The figures below were
// measured on a loaded laptop on 2026-11-13 and the budget leaves room for slower CI. The Edge Function has
// about 2 s of CPU. Measured with 50 foods and 20 recipes over 7 days: about 60 ms for an unmeetable shape the
// bounds rule out at once, and about 600 ms for four named targets that the fits cannot meet, which is the
// slowest shape found. A single fit can take over 10 ms when it cannot converge, which is why the cap counts
// fits.
const timeOf = (input: Parameters<typeof planMeals>[0]): number => {
  planMeals(input);
  const started = performance.now();
  planMeals(input);
  return performance.now() - started;
};

/** Calories, protein, carbs and fat that add up, so four named targets are all in play. */
const mixedNutrients = (kcal: number, protein_g: number) => ({
  kcal,
  protein_g,
  carbs_g: (kcal * 0.45) / 4,
  fat_g: (kcal * 0.3) / 9,
  fibre_g: 0,
});

const manyCandidates = () => {
  const foods = Array.from({ length: 50 }, (_, at) => ({
    ...foodOf(`food-${at}`, 0, 0, 40 + ((at * 25) % 200)),
    per100: mixedNutrients(40 + ((at * 37) % 400), 1 + ((at * 7) % 30)),
  }));
  const recipes = Array.from({ length: 20 }, (_, at) => ({
    ...recipeOf(`recipe-${at}`, 0, 0, 1 + (at % 4), ["morning", "midday", "evening"]),
    perServing: mixedNutrients(300 + ((at * 53) % 500), 15 + ((at * 11) % 40)),
  }));
  return { foods, recipes, ranking: [...recipes, ...foods].map(({ id }) => id) };
};

describe("planMeals work cap", () => {
  it(`should plan 7 unmeetable days from 50 foods and 20 recipes, four named targets, in under ${HEAVY_BUDGET_MILLISECONDS} ms`, () => {
    const elapsed = timeOf({
      ...manyCandidates(),
      rules: { ...RULES, maxRepeats: 1 },
      days: weekOf(7, { kcal: 9000, protein_g: 400, carbs_g: 10, fat_g: 5 }),
    });

    expect(elapsed).toBeLessThan(HEAVY_BUDGET_MILLISECONDS);
  });

  it(`should plan 7 days with ordinary four named targets from 50 foods and 20 recipes in under ${HEAVY_BUDGET_MILLISECONDS} ms`, () => {
    const elapsed = timeOf({
      ...manyCandidates(),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(7, { kcal: 1500, protein_g: 100, carbs_g: 300, fat_g: 10 }),
    });

    expect(elapsed).toBeLessThan(HEAVY_BUDGET_MILLISECONDS);
  });

  it("should report the days it ran out of fits for as short with the reason work_limit", () => {
    const plan = planMeals({
      ...manyCandidates(),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(7, { kcal: 1500, protein_g: 100, carbs_g: 300, fat_g: 10 }),
    });

    const limited = plan.days.filter((day) =>
      day.shortfalls.some(({ reason }) => reason === "work_limit"),
    );
    expect(limited.length).toBeGreaterThan(0);
    expect(limited.every((day) => day.status === "short")).toBe(true);
  });
});
