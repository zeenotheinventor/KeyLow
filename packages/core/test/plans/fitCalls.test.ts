import { describe, expect, it, vi } from "vitest";

import { foodOf, poolOf, recipeOf, RULES, weekOf } from "./pools";
import { PLAN_FIT_BUDGET, planMeals, replanDay } from "../../src/plans";
import * as fit from "../../src/recipes/fit";

// `fitCalls` is derived from the counter that enforces the cap, so this counts the calls the fitter really
// receives. A call site that skips the budget would make the two differ.
vi.mock("../../src/recipes/fit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/recipes/fit")>();
  return { ...actual, fitRecipeToTargets: vi.fn(actual.fitRecipeToTargets) };
});

const realCalls = (): number => vi.mocked(fit.fitRecipeToTargets).mock.calls.length;

const mixed = (kcal: number, protein_g: number) => ({
  kcal,
  protein_g,
  carbs_g: (kcal * 0.45) / 4,
  fat_g: (kcal * 0.3) / 9,
  fibre_g: 0,
});

// The smallest pool that still spends the whole fit budget. The planner's time goes on the fitter calls, so a
// bigger pool only made the test slower on a loaded runner.
const heavyPool = () => {
  const foods = Array.from({ length: 7 }, (_, at) => ({
    ...foodOf(`food-${at}`, 0, 0, 40 + ((at * 25) % 200)),
    per100: mixed(40 + ((at * 37) % 400), 1 + ((at * 7) % 30)),
  }));
  const recipes = Array.from({ length: 3 }, (_, at) => ({
    ...recipeOf(`recipe-${at}`, 0, 0, 1 + (at % 4), ["morning", "midday", "evening"]),
    perServing: mixed(300 + ((at * 53) % 500), 15 + ((at * 11) % 40)),
  }));
  return { foods, recipes, ranking: [] };
};

describe("the fitter calls a plan makes", () => {
  const cases = [
    {
      name: "an easy week",
      pool: poolOf({ recipes: [recipeOf("stew", 600, 40, 2)] }),
      target: undefined,
      spendsWholeBudget: false,
    },
    {
      name: "a heavy week",
      pool: { ...poolOf(), ...heavyPool() },
      target: { kcal: 1500, protein_g: 100, carbs_g: 300, fat_g: 10 },
      spendsWholeBudget: true,
    },
    {
      name: "an unmeetable week",
      pool: poolOf(),
      target: { kcal: 9000, protein_g: 400 },
      spendsWholeBudget: false,
    },
    {
      name: "one short day",
      pool: poolOf(),
      target: { kcal: 2400, protein_g: 190 },
      spendsWholeBudget: false,
    },
  ];

  it.each(cases)(
    "should make exactly the calls it reports, within the budget, for $name",
    ({ pool, target, spendsWholeBudget }) => {
      vi.mocked(fit.fitRecipeToTargets).mockClear();
      const input = { ...pool, rules: { ...RULES, maxRepeats: null }, days: weekOf(7, target) };

      const plan = planMeals(input);

      expect(realCalls()).toBe(plan.fitCalls);
      expect(plan.fitCalls).toBeGreaterThan(0);
      expect(plan.fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
      if (spendsWholeBudget) expect(plan.fitCalls).toBe(PLAN_FIT_BUDGET);

      vi.mocked(fit.fitRecipeToTargets).mockClear();
      const replanned = replanDay(plan, "2026-11-19", input);

      expect(realCalls()).toBe(replanned.fitCalls);
      expect(replanned.fitCalls).toBeLessThanOrEqual(PLAN_FIT_BUDGET);
    },
    // The 50 fitter calls are the cost, and the shared CI runner has been about 16x slower than local.
    45_000,
  );
});
