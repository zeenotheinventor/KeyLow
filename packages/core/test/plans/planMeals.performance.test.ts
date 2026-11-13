import { describe, expect, it } from "vitest";

import { EVAL_FOODS, EVAL_RANKING, EVAL_RECIPES, EVAL_WEEK } from "./evalKitchen";
import { foodOf, recipeOf, RULES, weekOf } from "./pools";
import { PLAN_FIT_BUDGET, planMeals, replanDay } from "../../src/plans";

import type { PlanBand } from "../../src/plans";

// Wall time on a shared runner is not the guarantee (the fit count is), so it is only a coarse smoke check, and
// only on the shapes a plan really has: calories and protein.
const SMOKE_MILLISECONDS = 3000;

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
  it(`should plan 7 days from 50 candidates within the fit budget`, () => {
    const input = { ...candidates(), rules: { ...RULES, maxRepeats: null }, days: weekOf(7) };
    planMeals(input);

    const started = performance.now();
    const { fitCalls } = planMeals(input);
    const elapsed = performance.now() - started;

    expect(fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
    expect(elapsed).toBeLessThan(SMOKE_MILLISECONDS);
  });
});

// What is capped is the number of fitter calls one plan may make (`PLAN_FIT_BUDGET`), not the time, and that
// count is what these tests assert through `fitCalls`. The guarantee is the fit count. A plan that runs out of
// fits reports its remaining days short with the reason `work_limit`. Plans name calories and protein only
// unless the person names carbs or fat, so the four named target shapes below are pathological and carry no
// wall time check. Measured with 50 foods and 20 recipes over 7 days: about 60 ms for an unmeetable shape the
// bounds rule out at once, and about 600 ms on the local loaded laptop for four named targets that the fits
// cannot meet, but over 3 s on the CI runner with other test files running in parallel. A single fit can take
// over 10 ms when it cannot converge, which is why the cap counts fits. KEY-1031 measures the real CPU on the
// Edge runtime and lowers `PLAN_FIT_BUDGET` if it needs to.
const measure = (input: Parameters<typeof planMeals>[0]) => ({
  fitCalls: planMeals(input).fitCalls,
});

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

describe("planMeals smoke check on the eval kitchen week", () => {
  it("should plan the eval week within the fit budget and the smoke time", () => {
    const started = performance.now();
    const { fitCalls } = planMeals({
      recipes: EVAL_RECIPES,
      foods: EVAL_FOODS,
      ranking: EVAL_RANKING,
      rules: { ...RULES, maxRepeats: 2 },
      days: EVAL_WEEK,
    });

    expect(fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
    expect(performance.now() - started).toBeLessThan(SMOKE_MILLISECONDS);
  });
});

describe("planMeals work cap", () => {
  it("should cap the fits of one plan at 50", () => {
    expect(PLAN_FIT_BUDGET).toBe(50);
  });

  it(`should plan 7 unmeetable days from 50 foods and 20 recipes, four named targets, within the fit budget (no wall time check)`, () => {
    const { fitCalls } = measure({
      ...manyCandidates(),
      rules: { ...RULES, maxRepeats: 1 },
      days: weekOf(7, { kcal: 9000, protein_g: 400, carbs_g: 10, fat_g: 5 }),
    });

    expect(fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
  });

  it(`should plan 7 days with ordinary four named targets from 50 foods and 20 recipes within the fit budget`, () => {
    const { fitCalls } = measure({
      ...manyCandidates(),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(7, { kcal: 1500, protein_g: 100, carbs_g: 300, fat_g: 10 }),
    });

    expect(fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
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

  it("should cap the fits of a replanned day at the budget too", () => {
    const input = {
      ...manyCandidates(),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(7, { kcal: 1500, protein_g: 100, carbs_g: 300, fat_g: 10 }),
    };

    const { fitCalls } = replanDay(planMeals(input), "2026-11-19", input);

    expect(fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
  });
});
